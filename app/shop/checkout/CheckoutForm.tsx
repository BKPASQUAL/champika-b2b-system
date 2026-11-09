"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Building2, ChevronLeft, ImageOff, Loader2, Lock, ShieldCheck, Truck } from "lucide-react";
import { useShop } from "../_components/ShopContext";
import { rs } from "../_components/format";
import { Field, Notice, btnPrimary, cardCls, inputCls } from "../_components/ui";
import { SL_DISTRICTS, normalisePhone } from "@/lib/shop-address";

type Line = { id: string; slug: string; name: string; image: string | null; price: number; qty: number; lineTotal: number; available: boolean };
type Priced = { lines: Line[]; missing: string[]; subtotal: number; savings: number; deliveryFee: number; total: number };
type Form = { name: string; phone: string; line1: string; line2: string; city: string; district: string };

export function CheckoutForm({ defaults, email, bankReady }: { defaults: Form; email: string | null; bankReady: boolean }) {
  const { cart, ready, href, clear, remove } = useShop();
  const router = useRouter();
  const [form, setForm] = useState<Form>(defaults);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [pay, setPay] = useState<"COD" | "BANK">("COD");
  const [note, setNote] = useState("");
  const [priced, setPriced] = useState<Priced | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Prices always come from the server.
  const load = async () => {
    const res = await fetch("/api/storefront/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load your cart");
    for (const id of json.missing as string[]) remove(id);
    setPriced(json);
  };
  useEffect(() => {
    if (!ready || placing) return;
    if (!cart.length) {
      setPriced({ lines: [], missing: [], subtotal: 0, savings: 0, deliveryFee: 0, total: 0 });
      return;
    }
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cart]);

  const validate = () => {
    const e: typeof errors = {};
    if (form.name.trim().length < 2) e.name = "Enter the receiver's name";
    if (!normalisePhone(form.phone)) e.phone = "Enter a valid phone number, e.g. 077 123 4567";
    if (form.line1.trim().length < 3) e.line1 = "Enter your house number and street";
    if (form.city.trim().length < 2) e.city = "Enter your town or city";
    if (!SL_DISTRICTS.includes(form.district)) e.district = "Choose your district";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const place = async () => {
    setError(null);
    if (!validate()) {
      setError("Please check the delivery details.");
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          delivery: { ...form, phone: normalisePhone(form.phone) },
          paymentMethod: pay,
          note,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.replace(`${href("/login")}?next=${encodeURIComponent("/checkout")}`);
        return;
      }
      if (!res.ok) {
        setError(json.error || "Could not place the order. Please try again.");
        if (res.status === 409) await load().catch(() => null);
        setPlacing(false);
        return;
      }
      clear();
      router.replace(`${href(`/account/orders/${json.orderNo}`)}?placed=1`);
      router.refresh();
    } catch {
      setError("Network problem. Please check your connection and try again.");
      setPlacing(false);
    }
  };

  if (!ready || !priced)
    return (
      <div className="flex justify-center py-24 text-(--s-muted)">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  const lines = priced.lines.filter((l) => l.available);
  if (!lines.length && !placing)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold">Your cart is empty</h1>
        <p className="mt-1 text-(--s-muted)">Add some items before checking out.</p>
        <Link href={href("/products")} className={`mt-6 ${btnPrimary}`}>
          Start shopping
        </Link>
      </div>
    );

  const payOptions = [
    { key: "COD" as const, icon: Banknote, title: "Cash on delivery", text: "Pay in cash when your order arrives." },
    {
      key: "BANK" as const,
      icon: Building2,
      title: "Bank transfer",
      text: bankReady ? "Transfer to our account, then upload the slip. We'll show the bank details next." : "We will send you our bank details.",
    },
  ];

  return (
    <div className="mx-auto px-4 py-6 md:px-6 md:py-8 xl:px-10">
      <Link href={href("/cart")} className="mb-4 inline-flex items-center gap-1 text-sm text-(--s-muted) hover:text-(--s-ink)">
        <ChevronLeft className="h-4 w-4" /> Back to cart
      </Link>
      <h1 className="mb-6 text-2xl font-bold md:text-[28px]">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px] xl:gap-8">
        <div className="space-y-6">
          {/* 1. Delivery */}
          <section className={`p-5 sm:p-6 ${cardCls}`}>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Step n={1} /> Delivery details
            </h2>
            {email && <p className="mt-1 text-sm text-(--s-muted)">Order updates go to {email}</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Receiver's name" error={errors.name}>
                <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Phone number" error={errors.phone} hint="The driver calls this number.">
                <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" placeholder="077 123 4567" />
              </Field>
              <Field label="House no. and street" error={errors.line1} className="sm:col-span-2">
                <input className={inputCls} value={form.line1} onChange={(e) => set("line1", e.target.value)} autoComplete="address-line1" placeholder="No. 12, Temple Road" />
              </Field>
              <Field label="Area / landmark (optional)" className="sm:col-span-2">
                <input className={inputCls} value={form.line2} onChange={(e) => set("line2", e.target.value)} autoComplete="address-line2" placeholder="Near the bus stand" />
              </Field>
              <Field label="Town / city" error={errors.city}>
                <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
              </Field>
              <Field label="District" error={errors.district}>
                <select className={inputCls} value={form.district} onChange={(e) => set("district", e.target.value)}>
                  <option value="">Choose…</option>
                  {SL_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* 2. Payment */}
          <section className={`p-5 sm:p-6 ${cardCls}`}>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Step n={2} /> Payment
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {payOptions.map((o) => {
                const on = pay === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setPay(o.key)}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      on ? "border-(--s-accent) bg-(--s-accent-soft)" : "border-(--s-line) hover:border-(--s-ink-2)"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-(--s-accent)" : "border-(--s-line)"}`}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-(--s-accent)" />}
                    </span>
                    <span>
                      <span className="flex items-center gap-2 font-semibold">
                        <o.icon className="h-4 w-4" /> {o.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-(--s-muted)">{o.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Field label="Note for us (optional)" className="mt-5">
              <textarea
                className={`${inputCls} h-24 resize-none py-3`}
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Best time to deliver, gate colour, etc."
              />
            </Field>
          </section>
        </div>

        {/* Summary */}
        <aside className={`h-fit space-y-4 p-5 sm:p-6 lg:sticky lg:top-24 ${cardCls}`}>
          <h2 className="text-lg font-bold">Your order</h2>
          <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--s-img)">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-(--s-muted)" />
                  )}
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-(--s-btn) px-1 text-[11px] font-bold text-(--s-btn-ink)">
                    {l.qty}
                  </span>
                </span>
                <span className="line-clamp-2 flex-1 text-sm">{l.name}</span>
                <span className="text-sm font-semibold">{rs(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-(--s-line) pt-4 text-sm">
            <Row label="Subtotal" value={rs(priced.subtotal)} />
            {priced.savings > 0 && <Row label="You save" value={`− ${rs(priced.savings)}`} cls="text-(--s-good)" />}
            <Row label="Delivery" value={priced.deliveryFee ? rs(priced.deliveryFee) : "Free"} />
          </dl>
          <div className="flex items-baseline justify-between border-t border-(--s-line) pt-4">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold">{rs(priced.total)}</span>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <button onClick={place} disabled={placing} className={`w-full ${btnPrimary} h-12 text-base`}>
            {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
            {placing ? "Placing order…" : `Place order · ${rs(priced.total)}`}
          </button>
          <ul className="space-y-1.5 text-xs text-(--s-muted)">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> We call to confirm before we send your order.
            </li>
            <li className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5" /> Delivered island-wide.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--s-btn) text-sm font-bold text-(--s-btn-ink)">{n}</span>;
}

function Row({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className={`flex justify-between ${cls}`}>
      <dt className="text-(--s-ink-2)">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
