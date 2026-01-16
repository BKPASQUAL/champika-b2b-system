"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { cn } from "@/lib/utils";

interface CreatePaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onPaymentSuccess: () => void;
}

export function CreatePaymentDialog({
  isOpen,
  setIsOpen,
  onPaymentSuccess,
}: CreatePaymentDialogProps) {
  const [loading, setLoading] = useState(false);

  // Data State
  const [unpaidOrders, setUnpaidOrders] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<any[]>([]);

  // UI State
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [bankSearchOpen, setBankSearchOpen] = useState(false); // ✅ Added State for Bank Search

  // Form State
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

  // 1. Fetch Data
  useEffect(() => {
    if (isOpen) {
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

      const fetchData = async () => {
        try {
          const user = getUserBusinessContext();
          const businessId = user?.businessId;

          // A. Fetch Unpaid Invoices
          const invRes = await fetch(`/api/invoices?businessId=${businessId}`);
          if (invRes.ok) {
            const invData = await invRes.json();
            const pending = invData
              .filter((inv: any) => inv.status !== "Paid" && inv.dueAmount > 0)
              .map((inv: any) => ({
                id: inv.orderId || inv.id,
                order_number: inv.invoiceNo,
                customer_name: inv.customerName,
                balance: inv.dueAmount,
              }));
            setUnpaidOrders(pending);
          }

          // B. Fetch Bank Codes
          const banksRes = await fetch(`/api/finance/bank-codes`);
          if (banksRes.ok) {
            const banksData = await banksRes.json();
            setBanks(banksData);
          }

          // C. Fetch Company Accounts
          const accRes = await fetch(
            `/api/finance/accounts?businessId=${businessId}`
          );
          if (accRes.ok) {
            const accData = await accRes.json();
            setCompanyAccounts(accData.filter((a: any) => a.is_active));
          }
        } catch (error) {
          console.error("Error loading payment data", error);
          toast.error("Failed to load data");
        }
      };
      fetchData();
    }
  }, [isOpen]);

  // 2. Filter Accounts based on Method
  const getAvailableAccounts = () => {
    if (formData.method === "cash") {
      return companyAccounts.filter(
        (acc) => acc.account_type === "Cash on Hand"
      );
    } else if (formData.method === "bank" || formData.method === "cheque") {
      return companyAccounts.filter(
        (acc) =>
          acc.account_type === "Savings" || acc.account_type === "Current"
      );
    }
    return [];
  };

  // 3. Submit Handler
  const handleAddPayment = async () => {
    if (!formData.orderId || formData.amount <= 0) {
      toast.error("Please select an order and enter valid amount");
      return;
    }

    const selectedOrder = unpaidOrders.find((o) => o.id === formData.orderId);
    if (selectedOrder && formData.amount > selectedOrder.balance) {
      toast.error(`Amount exceeds balance (LKR ${selectedOrder.balance})`);
      return;
    }

    if (
      (formData.method === "bank" || formData.method === "cash") &&
      !formData.depositAccountId
    ) {
      toast.error(`Please select a deposit account`);
      return;
    }

    if (
      formData.method === "cheque" &&
      (!formData.chequeNo || !formData.chequeDate || !formData.bankId)
    ) {
      toast.error("Please provide cheque number, date, and bank");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        orderId: formData.orderId,
        amount: Number(formData.amount),
        date: formData.date,
        method: formData.method,
        notes: formData.notes,
        depositAccountId:
          formData.method === "cash" || formData.method === "bank"
            ? formData.depositAccountId
            : null,
        chequeNo: formData.method === "cheque" ? formData.chequeNo : null,
        chequeDate: formData.method === "cheque" ? formData.chequeDate : null,
        bankId: formData.method === "cheque" ? formData.bankId : null,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      toast.success("Payment recorded successfully!");
      onPaymentSuccess();
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
          <DialogDescription>
            Record a new payment from customer
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Select Order */}
          <div className="col-span-2 space-y-2">
            <Label>Select Order / Invoice *</Label>
            <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-10"
                >
                  <span className="truncate">
                    {formData.orderId
                      ? unpaidOrders.find((o) => o.id === formData.orderId)
                          ?.order_number +
                        " - " +
                        unpaidOrders.find((o) => o.id === formData.orderId)
                          ?.customer_name
                      : "Select an order..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search invoice..." />
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
                              amount: order.balance,
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
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {order.order_number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {order.customer_name}
                            </span>
                          </div>
                          <div className="ml-auto font-bold text-red-600 text-xs">
                            LKR {order.balance.toLocaleString()}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount (LKR) *</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  amount: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Payment Date *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />
          </div>

          {/* Method */}
          <div className="space-y-2">
            <Label>Method</Label>
            <Select
              value={formData.method}
              onValueChange={(val) => setFormData({ ...formData, method: val })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom">
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Deposit Account */}
          {(formData.method === "cash" || formData.method === "bank") && (
            <div className="space-y-2">
              <Label>Deposit Account</Label>
              <Select
                value={formData.depositAccountId}
                onValueChange={(val) =>
                  setFormData({ ...formData, depositAccountId: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  {getAvailableAccounts().map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cheque Fields */}
          {formData.method === "cheque" && (
            <>
              {/* ✅ Searchable Bank Select */}
              <div className="space-y-2">
                <Label>Cheque Bank</Label>
                <Popover open={bankSearchOpen} onOpenChange={setBankSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={bankSearchOpen}
                      className="w-full justify-between"
                    >
                      {formData.bankId
                        ? banks.find((b) => b.id === formData.bankId)?.bank_name
                        : "Select Bank..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                    side="bottom"
                  >
                    <Command>
                      <CommandInput placeholder="Search bank..." />
                      <CommandList>
                        <CommandEmpty>No bank found.</CommandEmpty>
                        <CommandGroup>
                          {banks.map((bank) => (
                            <CommandItem
                              key={bank.id}
                              value={bank.bank_name}
                              onSelect={() => {
                                setFormData({ ...formData, bankId: bank.id });
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
                              {bank.bank_name} ({bank.bank_code})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Cheque No</Label>
                <Input
                  value={formData.chequeNo}
                  onChange={(e) =>
                    setFormData({ ...formData, chequeNo: e.target.value })
                  }
                  placeholder="xxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Cheque Date</Label>
                <Input
                  type="date"
                  value={formData.chequeDate}
                  onChange={(e) =>
                    setFormData({ ...formData, chequeDate: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddPayment}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Add Payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
