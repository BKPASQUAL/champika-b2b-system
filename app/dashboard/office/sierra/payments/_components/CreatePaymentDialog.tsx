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
import { cn } from "@/lib/utils";
import { invalidatePaymentCaches } from "@/hooks/useCachedFetch";

interface CreatePaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onPaymentSuccess: () => void;
  businessId: string;
}

export function CreatePaymentDialog({
  isOpen,
  setIsOpen,
  onPaymentSuccess,
  businessId,
}: CreatePaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [bankSearchOpen, setBankSearchOpen] = useState(false);

  const [unpaidOrders, setUnpaidOrders] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<any[]>([]);

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

          const banksRes = await fetch(`/api/finance/bank-codes`);
          if (banksRes.ok) setBanks(await banksRes.json());

          const accRes = await fetch(`/api/finance/accounts?businessId=${businessId}`);
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

  const getAvailableAccounts = () => {
    if (formData.method === "cash") {
      return companyAccounts.filter((acc) => {
        const t = (acc.account_type || "").toLowerCase();
        return t === "cash" || t === "cash on hand" || t === "wallet";
      });
    } else if (formData.method === "bank") {
      return companyAccounts.filter((acc) => {
        const t = (acc.account_type || "").toLowerCase();
        return t === "bank" || t === "savings" || t === "current";
      });
    }
    return [];
  };

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

      if (!res.ok) throw new Error(data.error || "Payment failed");

      toast.success("Payment recorded successfully!");
      invalidatePaymentCaches();
      onPaymentSuccess();
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedOrder = unpaidOrders.find((o) => o.id === formData.orderId);
  const selectedBank = banks.find((b) => b.id === formData.bankId);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
          <DialogDescription>Record a new payment from customer</DialogDescription>
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
                  className="w-full justify-between h-10 font-normal"
                >
                  <span className="truncate text-left">
                    {selectedOrder
                      ? `${selectedOrder.order_number} — ${selectedOrder.customer_name}`
                      : <span className="text-muted-foreground">Select an order...</span>}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                <Command>
                  <CommandInput placeholder="Search invoice or customer..." />
                  <CommandList>
                    <CommandEmpty>No unpaid orders found.</CommandEmpty>
                    <CommandGroup>
                      {unpaidOrders.map((order) => (
                        <CommandItem
                          key={order.id}
                          value={`${order.order_number} ${order.customer_name}`}
                          onSelect={() => {
                            setFormData({ ...formData, orderId: order.id, amount: order.balance });
                            setOrderSearchOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", formData.orderId === order.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex justify-between w-full">
                            <div className="flex flex-col">
                              <span className="font-medium">{order.order_number}</span>
                              <span className="text-xs text-muted-foreground">{order.customer_name}</span>
                            </div>
                            <span className="text-xs font-bold text-purple-600">LKR {order.balance.toLocaleString()}</span>
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
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Payment Date *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          {/* Method */}
          <div className="space-y-2">
            <Label>Method</Label>
            <Select
              value={formData.method}
              onValueChange={(val) => setFormData({ ...formData, method: val, depositAccountId: "", bankId: "" })}
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
                onValueChange={(val) => setFormData({ ...formData, depositAccountId: val })}
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
              <div className="space-y-2">
                <Label>Cheque Bank</Label>
                <Popover open={bankSearchOpen} onOpenChange={setBankSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-10 font-normal"
                    >
                      <span className="truncate">
                        {selectedBank
                          ? `${selectedBank.bank_name} (${selectedBank.bank_code})`
                          : <span className="text-muted-foreground">Select Bank...</span>}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                    <Command>
                      <CommandInput placeholder="Search bank..." />
                      <CommandList>
                        <CommandEmpty>No bank found.</CommandEmpty>
                        <CommandGroup>
                          {banks.map((bank) => (
                            <CommandItem
                              key={bank.id}
                              value={`${bank.bank_name} ${bank.bank_code}`}
                              onSelect={() => {
                                setFormData({ ...formData, bankId: bank.id });
                                setBankSearchOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.bankId === bank.id ? "opacity-100" : "opacity-0")} />
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
                  onChange={(e) => setFormData({ ...formData, chequeNo: e.target.value })}
                  placeholder="xxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Cheque Date</Label>
                <Input
                  type="date"
                  value={formData.chequeDate}
                  onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
