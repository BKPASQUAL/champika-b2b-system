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
  Banknote,
  Coins,
  CreditCard,
  PencilLine,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

// --- Types ---
interface BankCode {
  id: string;
  bank_code: string;
  bank_name: string;
}

type AccountType =
  | "Cash"
  | "Cash on Hand"
  | "Bank"
  | "Cheques"
  | "Wallet"
  | "Savings"
  | "Current";

interface BankAccount {
  id: string;
  account_name: string;
  account_type: AccountType;
  account_number: string | null;
  branch: string | null;
  current_balance: number;
  allow_overdraft: boolean;
  is_active: boolean;
  bank_codes?: {
    bank_code: string;
    bank_name: string;
  };
}

const TYPES_NEEDING_BANK: AccountType[] = ["Bank", "Savings", "Current"];

const ACCOUNT_TYPE_CONFIG: Record<
  AccountType,
  { color: string; bgColor: string; borderColor: string; icon: React.ElementType; label: string }
> = {
  Cash: {
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "bg-green-500",
    icon: Banknote,
    label: "Cash",
  },
  "Cash on Hand": {
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "bg-emerald-500",
    icon: Coins,
    label: "Cash on Hand",
  },
  Bank: {
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "bg-blue-500",
    icon: Landmark,
    label: "Bank",
  },
  Savings: {
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "bg-indigo-500",
    icon: Landmark,
    label: "Savings",
  },
  Current: {
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    borderColor: "bg-sky-500",
    icon: Building2,
    label: "Current",
  },
  Cheques: {
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "bg-orange-500",
    icon: CreditCard,
    label: "Cheques",
  },
  Wallet: {
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "bg-purple-500",
    icon: Wallet,
    label: "Wallet",
  },
};

// --- Helper ---
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);

export default function FinanceAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankCodes, setBankCodes] = useState<BankCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);

  // Add Form
  const [newAccount, setNewAccount] = useState({
    name: "",
    type: "Cash on Hand" as AccountType,
    bankCodeId: "",
    accountNumber: "",
    branch: "",
    initialBalance: "",
    allowOverdraft: false,
  });

  // Edit Form
  const [editForm, setEditForm] = useState({
    account_name: "",
    allow_overdraft: false,
    is_active: true,
    branch: "",
  });

  // Transfer Form
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
    } catch {
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
    const needsBank = TYPES_NEEDING_BANK.includes(newAccount.type);
    if (needsBank && !newAccount.bankCodeId) {
      toast.error("Please select a bank for this account type");
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
          account_number: newAccount.accountNumber || null,
          branch: newAccount.branch || null,
          current_balance: newAccount.initialBalance || 0,
          allow_overdraft: newAccount.allowOverdraft,
        }),
      });

      if (!res.ok) throw new Error("Failed to create account");

      toast.success("Account created successfully!");
      setIsAddOpen(false);
      fetchData();
      setNewAccount({
        name: "",
        type: "Cash on Hand",
        bankCodeId: "",
        accountNumber: "",
        branch: "",
        initialBalance: "",
        allowOverdraft: false,
      });
    } catch {
      toast.error("Error creating account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOpen = (account: BankAccount) => {
    setSelectedAccount(account);
    setEditForm({
      account_name: account.account_name,
      allow_overdraft: account.allow_overdraft,
      is_active: account.is_active,
      branch: account.branch || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedAccount) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedAccount.id,
          account_name: editForm.account_name,
          allow_overdraft: editForm.allow_overdraft,
          is_active: editForm.is_active,
          branch: editForm.branch || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update account");

      toast.success("Account updated successfully!");
      setIsEditOpen(false);
      fetchData();
    } catch {
      toast.error("Error updating account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (account: BankAccount) => {
    try {
      const res = await fetch("/api/finance/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: account.id,
          is_active: !account.is_active,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        `Account ${!account.is_active ? "activated" : "deactivated"} successfully`
      );
      fetchData();
    } catch {
      toast.error("Failed to update account status");
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
      fetchData();
      setTransferData({
        fromId: "",
        toId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
    } catch {
      toast.error("Error processing transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Computed ---
  const displayedAccounts = showInactive
    ? accounts
    : accounts.filter((a) => a.is_active);

  const totalBalance = accounts
    .filter((a) => a.is_active)
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const cashBalance = accounts
    .filter(
      (a) =>
        a.is_active &&
        (a.account_type === "Cash" || a.account_type === "Cash on Hand")
    )
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const bankBalance = accounts
    .filter(
      (a) =>
        a.is_active &&
        ["Bank", "Savings", "Current"].includes(a.account_type)
    )
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const needsBankCode = TYPES_NEEDING_BANK.includes(newAccount.type);

  if (loading)
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Accounts</h1>
          <p className="text-muted-foreground">
            Manage company accounts, cash, wallets and cheque registers
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? (
              <>
                <ToggleRight className="mr-2 h-4 w-4" /> Hide Inactive
              </>
            ) : (
              <>
                <ToggleLeft className="mr-2 h-4 w-4" /> Show Inactive
              </>
            )}
          </Button>
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-slate-400 mt-1">All active accounts</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              Cash & On-Hand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">
              {formatCurrency(cashBalance)}
            </div>
            <p className="text-xs text-green-600 mt-1">Cash accounts</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">
              Bank Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">
              {formatCurrency(bankBalance)}
            </div>
            <p className="text-xs text-blue-600 mt-1">Bank / Savings / Current</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Grid */}
      {displayedAccounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No accounts found. Click &quot;Add Account&quot; to get started.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedAccounts.map((account) => {
            const config =
              ACCOUNT_TYPE_CONFIG[account.account_type] ||
              ACCOUNT_TYPE_CONFIG["Bank"];
            const Icon = config.icon;

            return (
              <div key={account.id} className="relative">
                <Link
                  href={`/dashboard/admin/finance/accounts/${account.id}`}
                  className="block"
                >
                  <Card
                    className={cn(
                      "relative overflow-hidden group transition-all cursor-pointer h-full",
                      !account.is_active && "opacity-60",
                      "hover:shadow-md"
                    )}
                  >
                    {/* Color side bar */}
                    <div
                      className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        config.borderColor
                      )}
                    />
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pr-2">
                      <div className="ml-1 flex-1 min-w-0">
                        <CardTitle className="text-sm font-semibold line-clamp-1">
                          {account.account_name}
                        </CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs px-1.5 py-0",
                              config.color,
                              config.bgColor,
                              "border-0"
                            )}
                          >
                            {account.account_type}
                          </Badge>
                          {!account.is_active && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.color)} />
                    </CardHeader>
                    <CardContent className="ml-1">
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
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {account.bank_codes && (
                          <div>{account.bank_codes.bank_name}</div>
                        )}
                        {account.account_number && (
                          <div className="font-mono">{account.account_number}</div>
                        )}
                        {account.branch && <div>Branch: {account.branch}</div>}
                        {!account.bank_codes && !account.account_number && (
                          <div className="capitalize">{account.account_type}</div>
                        )}
                      </div>
                      {account.allow_overdraft && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded w-fit">
                          <AlertCircle className="h-3 w-3" />
                          <span>Overdraft Enabled</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>

                {/* Action buttons overlay */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 pointer-events-auto bg-white shadow-sm border"
                    onClick={(e) => {
                      e.preventDefault();
                      handleEditOpen(account);
                    }}
                    title="Edit account"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-7 w-7 pointer-events-auto bg-white shadow-sm border",
                      account.is_active
                        ? "hover:bg-red-50 hover:text-red-600"
                        : "hover:bg-green-50 hover:text-green-600"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      handleToggleActive(account);
                    }}
                    title={account.is_active ? "Deactivate" : "Activate"}
                  >
                    {account.is_active ? (
                      <ToggleRight className="h-3.5 w-3.5" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== ADD ACCOUNT DIALOG ===================== */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogDescription>
              Create a new account for cash, bank, wallet, or cheque management.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Account Name */}
            <div className="grid gap-2">
              <Label>Account Name *</Label>
              <Input
                placeholder="e.g. Main Cash Register, Commercial Bank OD"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              />
            </div>

            {/* Account Type */}
            <div className="grid gap-2">
              <Label>Account Type *</Label>
              <Select
                value={newAccount.type}
                onValueChange={(val) =>
                  setNewAccount({
                    ...newAccount,
                    type: val as AccountType,
                    bankCodeId: "",
                    accountNumber: "",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">💵 Cash</SelectItem>
                  <SelectItem value="Cash on Hand">🪙 Cash on Hand</SelectItem>
                  <SelectItem value="Bank">🏦 Bank Account</SelectItem>
                  <SelectItem value="Savings">💰 Savings Account</SelectItem>
                  <SelectItem value="Current">🏢 Current Account</SelectItem>
                  <SelectItem value="Cheques">📋 Cheques Register</SelectItem>
                  <SelectItem value="Wallet">👛 Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Picker — only for Bank/Savings/Current */}
            {needsBankCode && (
              <>
                <div className="grid gap-2">
                  <Label>Bank *</Label>
                  <Popover open={bankSearchOpen} onOpenChange={setBankSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {newAccount.bankCodeId
                          ? bankCodes.find((b) => b.id === newAccount.bankCodeId)
                              ?.bank_name
                          : "Select bank..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[460px] p-0" align="start">
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
                                  setNewAccount({ ...newAccount, bankCodeId: bank.id });
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
                                {bank.bank_code} — {bank.bank_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Account Number</Label>
                    <Input
                      placeholder="Enter account number"
                      value={newAccount.accountNumber}
                      onChange={(e) =>
                        setNewAccount({ ...newAccount, accountNumber: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Branch</Label>
                    <Input
                      placeholder="e.g. Colombo 03"
                      value={newAccount.branch}
                      onChange={(e) =>
                        setNewAccount({ ...newAccount, branch: e.target.value })
                      }
                    />
                  </div>
                </div>
              </>
            )}

            {/* Opening Balance */}
            <div className="grid gap-2">
              <Label>Opening Balance (LKR)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={newAccount.initialBalance}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, initialBalance: e.target.value })
                }
              />
            </div>

            {/* Overdraft */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Allow Overdraft</Label>
                <p className="text-xs text-muted-foreground">
                  Allow balance to go below zero
                </p>
              </div>
              <Switch
                checked={newAccount.allowOverdraft}
                onCheckedChange={(checked) =>
                  setNewAccount({ ...newAccount, allowOverdraft: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== EDIT ACCOUNT DIALOG ===================== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details for{" "}
              <strong>{selectedAccount?.account_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Account Name</Label>
              <Input
                value={editForm.account_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, account_name: e.target.value })
                }
              />
            </div>
            {TYPES_NEEDING_BANK.includes(
              selectedAccount?.account_type as AccountType
            ) && (
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Input
                  placeholder="Branch name"
                  value={editForm.branch}
                  onChange={(e) =>
                    setEditForm({ ...editForm, branch: e.target.value })
                  }
                />
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Allow Overdraft</Label>
                <p className="text-xs text-muted-foreground">
                  Allow balance below zero
                </p>
              </div>
              <Switch
                checked={editForm.allow_overdraft}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, allow_overdraft: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Active Account</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive accounts are hidden in payment selectors
                </p>
              </div>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== TRANSFER DIALOG ===================== */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Internal Transfer</DialogTitle>
            <DialogDescription>Move money between your accounts.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>From Account</Label>
              <Select
                value={transferData.fromId}
                onValueChange={(val) => setTransferData({ ...transferData, fromId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.is_active)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name} ({formatCurrency(acc.current_balance)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>To Account</Label>
              <Select
                value={transferData.toId}
                onValueChange={(val) => setTransferData({ ...transferData, toId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.is_active && a.id !== transferData.fromId)
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
                placeholder="0.00"
                value={transferData.amount}
                onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={transferData.date}
                onChange={(e) => setTransferData({ ...transferData, date: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                placeholder="Reason for transfer..."
                value={transferData.description}
                onChange={(e) =>
                  setTransferData({ ...transferData, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4" /> Confirm Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
