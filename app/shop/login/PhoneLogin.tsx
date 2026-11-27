"use client";

import { useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useShop } from "../_components/ShopContext";
import { Field, Notice, btnDark, inputCls } from "../_components/ui";

/** "077 123 4567" / "0771234567" / "+94771234567" → "+94771234567"; null when not a Sri Lankan mobile number. */
export function toSriLankaMobile(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "");
  const local = d.startsWith("+94") ? d.slice(3) : d.startsWith("94") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return /^7\d{8}$/.test(local) ? `+94${local}` : null;
}

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("phone") && (m.includes("not enabled") || m.includes("unsupported") || m.includes("provider")))
    return "Login by SMS is not switched on yet. Please log in with email below, or call / WhatsApp us.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many tries. Please wait a minute and try again.";
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) return "That code is wrong or has expired. Please try again.";
  return msg;
}

/**
 * Shop login with a phone number and a one-time SMS code (Champika shop).
 * Supabase sends the code through our SMS hook (app/api/storefront/sms-hook → Notify.lk).
 */
export function PhoneLogin({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useShop();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const p = toSriLankaMobile(phone);
    if (!p) return setError(t("Enter your mobile number, e.g. 077 123 4567."));
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOtp({ phone: p });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setSentTo(p);
    setCode("");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) return setError(t("Enter the 6-digit code from the SMS."));
    setBusy(true);
    const { error } = await supabaseBrowser().auth.verifyOtp({ phone: sentTo, token: code.trim(), type: "sms" });
    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    await onDone();
  };

  return (
    <div className="mt-6 rounded-2xl border-2 border-(--s-accent)/30 bg-(--s-accent-soft)/50 p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-(--s-accent)" aria-hidden />
        <div>
          <p className="font-bold text-(--s-ink)">{t("Log in with your phone number")}</p>
          <p className="mt-0.5 text-sm text-(--s-ink-2)">{t("We send a 6-digit code by SMS. No password needed.")}</p>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {!sentTo ? (
        <form onSubmit={send} className="mt-3 space-y-3" noValidate>
          <Field label={t("Mobile number")}>
            <input
              className={inputCls}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <button type="submit" disabled={busy} className={`w-full ${btnDark}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t("Send me a code")}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-3 space-y-3" noValidate>
          <Field label={t("Code sent to {phone}", { phone: sentTo.replace(/^\+94/, "0") })}>
            <input
              className={`${inputCls} tracking-[0.4em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <button type="submit" disabled={busy} className={`w-full ${btnDark}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t("Log in")}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => setSentTo(null)} className="text-(--s-muted) hover:text-(--s-ink)">
              {t("Change number")}
            </button>
            <button type="button" onClick={() => send()} disabled={busy} className="font-semibold text-(--s-accent) hover:underline">
              {t("Send the code again")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
