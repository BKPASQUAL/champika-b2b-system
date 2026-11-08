"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, Notice, btnDark, cardCls, inputCls } from "../_components/ui";
import { SL_DISTRICTS, normalisePhone } from "@/lib/shop-address";

type Form = { fullName: string; phone: string; line1: string; line2: string; city: string; district: string };

/** Name, phone and saved delivery address (pre-fills checkout). */
export function ProfileForm({ initial, email }: { initial: Form; email: string | null }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.fullName.trim().length < 2) return setError("Enter your name.");
    const phone = normalisePhone(f.phone);
    if (!phone) return setError("Enter a valid phone number, e.g. 077 123 4567.");
    const anyAddress = f.line1 || f.city || f.district;
    if (anyAddress && (f.line1.trim().length < 3 || f.city.trim().length < 2 || !f.district))
      return setError("Fill in street, town and district — or leave the address empty.");

    setBusy(true);
    const res = await fetch("/api/storefront/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: f.fullName,
        phone,
        address: anyAddress ? { line1: f.line1, line2: f.line2, city: f.city, district: f.district } : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not save. Please try again.");
    toast.success("Your details are saved");
    router.refresh();
  };

  return (
    <form onSubmit={save} className={`space-y-6 p-5 sm:p-6 ${cardCls}`}>
      <div>
        <h2 className="text-lg font-bold">My details</h2>
        <p className="text-sm text-(--s-muted)">We use these to fill in checkout for you.</p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input className={inputCls} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Phone number">
          <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" placeholder="077 123 4567" />
        </Field>
        <Field label="Email" hint="Your login email can't be changed here." className="sm:col-span-2">
          <input className={inputCls} value={email || ""} disabled />
        </Field>
      </div>

      <div>
        <h3 className="font-semibold">Delivery address</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
      </div>

      <button disabled={busy} className={btnDark}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save details
      </button>
    </form>
  );
}
