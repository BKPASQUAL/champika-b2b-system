"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type CreatedCustomer = { id: string; name: string; shop_name: string; owner_name?: string };

/** "+ New" button that adds a customer to the given business and hands it back. */
export function NewCustomerButton({
  businessId,
  onCreated,
}: {
  businessId: string;
  onCreated: (c: CreatedCustomer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ shopName: "", ownerName: "", phone: "", address: "" });

  const save = async () => {
    if (!form.shopName.trim()) return toast.error("Customer / shop name is required");
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: form.shopName.trim(),
          ownerName: form.ownerName.trim() || undefined,
          phone: form.phone.trim(),
          address: form.address.trim() || undefined,
          businessId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add customer");
      const c = data.data;
      onCreated({ id: c.id, name: c.shop_name, shop_name: c.shop_name, owner_name: c.owner_name || undefined });
      toast.success(`Customer "${c.shop_name}" added`);
      setForm({ shopName: "", ownerName: "", phone: "", address: "" });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Could not add customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => setOpen(true)}>
        <UserPlus className="w-3 h-3 mr-1" /> New customer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Customer / shop name *</Label>
              <Input autoFocus value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="e.g. Kamal Perera" />
            </div>
            <div className="space-y-1">
              <Label>Contact person</Label>
              <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07X XXX XXXX" />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Add customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
