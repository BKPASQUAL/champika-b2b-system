"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { printPaymentVoucher, type PaymentVoucher } from "@/app/lib/payment-voucher-print";

export interface VoucherPaymentInput {
  id: string;
  amount: number;
  cheque_number: string | null;
  cheque_date: string | null;
  supplier_id?: string;
  company_accounts: { account_name: string } | null;
  purchases: {
    purchase_id: string;
    invoice_no?: string | null;
    purchase_date?: string | null;
    total_amount?: number;
    suppliers: { name: string } | null;
  } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  payments: VoucherPaymentInput[];
  onSuccess: () => void;
  /** Earlier vouchers — used to offer previously entered people in a dropdown */
  pastVouchers?: PaymentVoucher[];
}

interface SavedPerson {
  key: string;
  name: string;
  nic: string;
  phone: string;
  designation: string;
  sameSupplier: boolean;
  supplierName: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(n);

const today = () => new Date().toISOString().split("T")[0];

const emptyForm = () => ({
  receiverName: "", receiverNic: "", receiverDesignation: "", receiverPhone: "",
  voucherDate: today(), notes: "",
});

export default function PaymentVoucherDialog({ open, onClose, payments, onSuccess, pastVouchers = [] }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [pickedKey, setPickedKey] = useState("");
  const [printAfter, setPrintAfter] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setPrintAfter(true);
      setPickedKey("");
    }
  }, [open]);

  const supplierName = payments[0]?.purchases?.suppliers?.name ?? "";
  const supplierId = payments[0]?.supplier_id;
  const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const chequeCount = useMemo(
    () => new Set(payments.map((p) => p.cheque_number || p.id)).size,
    [payments],
  );

  // People entered on earlier vouchers (newest details win), this supplier's people first
  const savedPeople = useMemo(() => {
    const m = new Map<string, SavedPerson>();
    const list = Array.isArray(pastVouchers) ? pastVouchers : [];
    // pastVouchers come newest first, so the first time we see a person is their latest details
    for (const v of list) {
      const name = (v.receiver_name || "").trim();
      if (!name) continue;
      const key = `${name.toLowerCase()}|${(v.receiver_nic || "").trim().toLowerCase()}`;
      const same = !!supplierId && v.supplier_id === supplierId;
      const existing = m.get(key);
      if (existing) {
        if (same) existing.sameSupplier = true;
        continue;
      }
      m.set(key, {
        key,
        name,
        nic: v.receiver_nic || "",
        phone: v.receiver_phone || "",
        designation: v.receiver_designation || "",
        sameSupplier: same,
        supplierName: v.supplier_name || "",
      });
    }
    return [...m.values()].sort((a, b) =>
      a.sameSupplier === b.sameSupplier ? a.name.localeCompare(b.name) : a.sameSupplier ? -1 : 1
    );
  }, [pastVouchers, supplierId]);

  const pickPerson = (key: string) => {
    setPickedKey(key);
    const p = savedPeople.find((x) => x.key === key);
    if (!p) return;
    setForm((f) => ({
      ...f,
      receiverName: p.name,
      receiverNic: p.nic,
      receiverPhone: p.phone,
      receiverDesignation: p.designation,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let preparedBy = "";
      try {
        const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
        preparedBy = u.fullName || u.name || "";
      } catch {}

      const res = await fetch("/api/suppliers/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, paymentIds: payments.map((p) => p.id), preparedBy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create voucher");

      toast.success(`Voucher ${data.voucher_number} created`);
      if (printAfter) printPaymentVoucher(data as PaymentVoucher);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof ReturnType<typeof emptyForm>) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-indigo-600" />
            Create Payment Voucher
          </DialogTitle>
          <DialogDescription>
            {supplierName} · {chequeCount} cheque(s) · {payments.length} invoice(s) · {fmt(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-md border bg-slate-50 p-3 max-h-40 overflow-y-auto space-y-1 text-xs">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between gap-2">
                <span>
                  <span className="font-medium">{p.purchases?.invoice_no || p.purchases?.purchase_id}</span>
                  <span className="text-muted-foreground"> · Chq </span>
                  <span className="font-mono">{p.cheque_number || "—"}</span>
                  {p.cheque_date && (
                    <span className="text-muted-foreground"> · {new Date(p.cheque_date).toLocaleDateString()}</span>
                  )}
                </span>
                <span className="font-semibold">{fmt(Number(p.amount) || 0)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-800">
            Authorized person who takes the cheques — all optional. Leave blank to write the name,
            NIC and mobile by hand on the printed voucher. They sign on the printout.
          </div>

          {savedPeople.length > 0 && (
            <div className="space-y-1.5">
              <Label>Choose a saved person</Label>
              <Select value={pickedKey} onValueChange={pickPerson}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select from earlier vouchers…" />
                </SelectTrigger>
                <SelectContent>
                  {savedPeople.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {[p.nic, p.phone, p.sameSupplier ? supplierName : p.supplierName]
                          .filter(Boolean)
                          .map((s) => ` · ${s}`)
                          .join("")}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Authorized person name</Label>
            <Input value={form.receiverName} onChange={set("receiverName")} placeholder="Leave blank to write by hand" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>NIC / ID No</Label>
              <Input value={form.receiverNic} onChange={set("receiverNic")} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile No</Label>
              <Input value={form.receiverPhone} onChange={set("receiverPhone")} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Input value={form.receiverDesignation} onChange={set("receiverDesignation")} placeholder="Optional, e.g. Sales Rep" />
            </div>
            <div className="space-y-1.5">
              <Label>Voucher Date</Label>
              <Input type="date" value={form.voucherDate} onChange={set("voucherDate")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={set("notes")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={printAfter} onCheckedChange={(v) => setPrintAfter(!!v)} />
            Print voucher after saving
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Save Voucher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
