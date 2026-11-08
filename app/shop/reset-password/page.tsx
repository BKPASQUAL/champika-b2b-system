"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useShop } from "../_components/ShopContext";
import { Field, Notice, btnDark, cardCls, inputCls } from "../_components/ui";

/** Opened from the password-reset email (the link logs the customer in first). */
export default function ResetPasswordPage() {
  const { href } = useShop();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) return setError("Password must be at least 6 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setError(error.message.toLowerCase().includes("session") ? "This reset link has expired. Please ask for a new one." : error.message);
      return;
    }
    toast.success("Password changed");
    router.replace(href("/account"));
    router.refresh();
  };

  return (
    <div className="mx-auto flex justify-center px-4 py-10 md:py-16">
      <form onSubmit={submit} className={`w-full max-w-md space-y-4 p-6 sm:p-8 ${cardCls}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--s-accent-soft) text-(--s-accent)">
          <KeyRound className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="mt-1 text-sm text-(--s-muted)">Choose a password you don't use on other websites.</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="New password" hint="At least 6 characters.">
          <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Type it again">
          <input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        <button disabled={busy} className={`w-full ${btnDark}`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save password
        </button>
      </form>
    </div>
  );
}
