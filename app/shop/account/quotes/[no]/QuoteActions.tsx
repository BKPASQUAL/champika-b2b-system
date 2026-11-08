"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "../../../_components/ShopContext";
import { Field, Notice, btnOutline, btnPrimary, cardCls, inputCls } from "../../../_components/ui";
import { SL_DISTRICTS, normalisePhone } from "@/lib/shop-address";

type Form = { name: string; phone: string; line1: string; line2: string; city: string; district: string };

/** Accept (choose delivery + payment → order) or decline a quotation. */
export function QuoteActions({ no, canAccept, defaults }: { no: string; canAccept: boolean; defaults: Form }) {
  const { href } = useShop();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(defaults);
  const [pay, setPay] = useState<"COD" | "BANK">("COD");
  const [busy, setBusy] = useState<"" | "accept" | "reject">("");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }));

  const post = (body: unknown) =>
    fetch(`/api/storefront/quotes/${encodeURIComponent(no)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => ({ ok: r.ok, json: await r.json().catch(() => ({})) }));

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const phone = normalisePhone(f.phone);
    if (f.name.trim().length < 2) return setError("Enter the receiver's name.");
    if (!phone) return setError("Enter a valid phone number, e.g. 077 123 4567.");
    if (f.line1.trim().length < 3 || f.city.trim().length < 2 || !f.district) return setError("Enter the full delivery address.");
    setBusy("accept");
    const { ok, json } = await post({ action: "accept", paymentMethod: pay, delivery: { ...f, phone } });
    if (!ok) {
      setBusy("");
      return setError(json.error || "Could not accept. Please try again.");
    }
    toast.success("Order placed!");
    router.replace(`${href(`/account/orders/${json.orderNo}`)}?placed=1`);
    router.refresh();
  };

  const reject = async () => {
    if (!confirm(canAccept ? "Decline this quotation?" : "Cancel this request?")) return;
    setBusy("reject");
    const { ok, json } = await post({ action: "reject" });
    setBusy("");
    if (!ok) return toast.error(json.error || "Could not update.");
    router.refresh();
  };

  if (!canAccept)
    return (
      <button onClick={reject} disabled={!!busy} className="text-sm font-medium text-(--s-muted) hover:text-(--s-bad)">
        {busy === "reject" ? "Cancelling…" : "Cancel this request"}
      </button>
    );

  if (!open)
    return (
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setOpen(true)} className={`${btnPrimary} h-12 px-8 text-base`}>
          <CheckCircle2 className="h-5 w-5" /> Accept & order
        </button>
        <button onClick={reject} disabled={!!busy} className={btnOutline}>
          {busy === "reject" && <Loader2 className="h-4 w-4 animate-spin" />} Decline
        </button>
      </div>
    );

  return (
    <form onSubmit={accept} className={`space-y-5 p-5 sm:p-6 ${cardCls}`}>
      <h3 className="text-lg font-bold">Where should we deliver?</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Receiver's name">
          <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Phone number">
          <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="House no. and street" className="sm:col-span-2">
          <input className={inputCls} value={f.line1} onChange={(e) => set("line1", e.target.value)} autoComplete="address-line1" />
        </Field>
        <Field label="Area / landmark (optional)" className="sm:col-span-2">
          <input className={inputCls} value={f.line2} onChange={(e) => set("line2", e.target.value)} autoComplete="address-line2" />
        </Field>
        <Field label="Town / city">
          <input className={inputCls} value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
        </Field>
        <Field label="District">
          <select className={inputCls} value={f.district} onChange={(e) => set("district", e.target.value)}>
            <option value="">Choose…</option>
            {SL_DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { key: "COD", icon: Banknote, title: "Cash on delivery" },
            { key: "BANK", icon: Building2, title: "Bank transfer" },
          ] as const
        ).map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setPay(o.key)}
            className={`flex items-center gap-2 rounded-2xl border-2 p-4 text-left font-semibold transition ${
              pay === o.key ? "border-(--s-accent) bg-(--s-accent-soft)" : "border-(--s-line) hover:border-(--s-ink-2)"
            }`}
          >
            <o.icon className="h-4 w-4" /> {o.title}
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-3">
        <button disabled={!!busy} className={`${btnPrimary} h-12 px-8`}>
          {busy === "accept" && <Loader2 className="h-4 w-4 animate-spin" />} Place order
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnOutline}>
          Back
        </button>
      </div>
    </form>
  );
}
