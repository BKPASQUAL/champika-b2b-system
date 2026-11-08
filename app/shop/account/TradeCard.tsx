"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock, HardHat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, Notice, btnDark, cardCls, inputCls } from "../_components/ui";

/** Electricians / contractors ask for trade prices; the office approves. */
export function TradeCard({ status }: { status: "none" | "pending" | "approved" | "rejected" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [biz, setBiz] = useState("");
  const [reg, setReg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "approved")
    return (
      <div className={`flex items-center gap-3 p-5 ${cardCls}`}>
        <BadgeCheck className="h-6 w-6 shrink-0 text-(--s-good)" />
        <div>
          <p className="font-semibold">Trade prices are on</p>
          <p className="text-sm text-(--s-muted)">You see electrician/contractor prices across the shop.</p>
        </div>
      </div>
    );
  if (status === "pending")
    return (
      <div className={`flex items-center gap-3 p-5 ${cardCls}`}>
        <Clock className="h-6 w-6 shrink-0 text-(--s-accent)" />
        <div>
          <p className="font-semibold">Trade request received</p>
          <p className="text-sm text-(--s-muted)">We'll check your details and switch on trade prices soon.</p>
        </div>
      </div>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/storefront/me/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: biz, regNo: reg }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not send. Please try again.");
    toast.success("Request sent");
    router.refresh();
  };

  return (
    <div className={`p-5 sm:p-6 ${cardCls}`}>
      <div className="flex items-start gap-3">
        <HardHat className="mt-0.5 h-6 w-6 shrink-0 text-(--s-accent)" />
        <div className="flex-1">
          <p className="font-semibold">Electrician or contractor?</p>
          <p className="text-sm text-(--s-muted)">
            {status === "rejected" ? "Your last request wasn't approved. You can send new details." : "Ask for trade prices on everything you buy."}
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="text-sm font-semibold text-(--s-accent) hover:underline">
            Apply
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business / trade name">
              <input className={inputCls} value={biz} onChange={(e) => setBiz(e.target.value)} placeholder="Perera Electricals" />
            </Field>
            <Field label="NIC or business reg. no.">
              <input className={inputCls} value={reg} onChange={(e) => setReg(e.target.value)} />
            </Field>
          </div>
          <button disabled={busy} className={btnDark}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send request
          </button>
        </form>
      )}
    </div>
  );
}
