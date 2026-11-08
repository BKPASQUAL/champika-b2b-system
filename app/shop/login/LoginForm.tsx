"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useShop } from "../_components/ShopContext";
import { Field, GoogleIcon, Notice, btnDark, btnOutline, cardCls, inputCls } from "../_components/ui";

type Mode = "login" | "signup" | "forgot";

/** Turn Supabase messages into plain words for customers. */
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for our link.";
  if (m.includes("already registered") || m.includes("already exists")) return "This email already has an account. Log in instead.";
  if (m.includes("password should be")) return "Password must be at least 6 characters.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Please wait a minute and try again.";
  if (m.includes("provider is not enabled")) return "Google login is not switched on yet. Please use email for now.";
  return msg;
}

export function LoginForm({ next, initialError, initialMode }: { next: string; initialError: string | null; initialMode: "login" | "signup" }) {
  const { href, store } = useShop();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<"" | "google" | "form">("");
  const [error, setError] = useState<string | null>(initialError);
  const [sentTo, setSentTo] = useState<{ kind: "confirm" | "reset"; email: string } | null>(null);

  const callbackUrl = (to: string) => `${window.location.origin}${href("/auth/callback")}?next=${encodeURIComponent(to)}`;

  /** Logged in: make sure the customer record exists, then continue. */
  const finish = async () => {
    await fetch("/api/storefront/me").catch(() => null);
    router.replace(href(next));
    router.refresh();
  };

  const google = async () => {
    setError(null);
    setBusy("google");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(next), queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setError(friendly(error.message));
      setBusy("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError("Enter a valid email address.");
    if (mode !== "forgot" && password.length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "signup" && name.trim().length < 2) return setError("Enter your name.");

    setBusy("form");
    const sb = supabaseBrowser();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: mail, password });
        if (error) throw error;
        await finish();
        return;
      }
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email: mail,
          password,
          options: { emailRedirectTo: callbackUrl(next), data: { full_name: name.trim() } },
        });
        if (error) throw error;
        // Supabase returns no identities when the email is already used.
        if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error("already registered");
        if (data.session) {
          await finish();
          return;
        }
        setSentTo({ kind: "confirm", email: mail });
        return;
      }
      const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: callbackUrl("/reset-password") });
      if (error) throw error;
      setSentTo({ kind: "reset", email: mail });
    } catch (err: any) {
      setError(friendly(err?.message || "Something went wrong. Please try again."));
    } finally {
      setBusy("");
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSentTo(null);
  };

  const titles: Record<Mode, { title: string; sub: string }> = {
    login: { title: "Welcome back", sub: `Log in to order from ${store.name}.` },
    signup: { title: "Create your account", sub: "Order online and track your deliveries." },
    forgot: { title: "Reset your password", sub: "We will email you a link to set a new password." },
  };

  return (
    <div className="mx-auto flex max-w-[1800px] justify-center px-4 py-10 md:py-16">
      <div className={`w-full max-w-md p-6 sm:p-8 ${cardCls}`}>
        {sentTo ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-(--s-accent-soft) text-(--s-accent)">
              <MailCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-(--s-ink-2)">
              We sent a link to <b className="text-(--s-ink)">{sentTo.email}</b>.{" "}
              {sentTo.kind === "confirm" ? "Click it to confirm your account and continue." : "Click it to set a new password."}
            </p>
            <p className="mt-2 text-xs text-(--s-muted)">Can't find it? Look in your Spam or Promotions folder.</p>
            <button onClick={() => switchMode("login")} className={`mt-6 w-full ${btnOutline}`}>
              Back to log in
            </button>
          </div>
        ) : (
          <>
            {mode === "forgot" && (
              <button onClick={() => switchMode("login")} className="mb-4 inline-flex items-center gap-1 text-sm text-(--s-muted) hover:text-(--s-ink)">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            <h1 className="text-2xl font-bold">{titles[mode].title}</h1>
            <p className="mt-1 text-sm text-(--s-muted)">{titles[mode].sub}</p>

            {mode !== "forgot" && (
              <>
                {/* Log in / Create account switch */}
                <div className="mt-6 grid grid-cols-2 rounded-full bg-(--s-soft) p-1 text-sm font-semibold">
                  {(["login", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`rounded-full py-2 transition ${mode === m ? "bg-(--s-surface) text-(--s-ink) shadow-sm" : "text-(--s-muted) hover:text-(--s-ink)"}`}
                    >
                      {m === "login" ? "Log in" : "Create account"}
                    </button>
                  ))}
                </div>

                <button type="button" onClick={google} disabled={!!busy} className={`mt-5 w-full ${btnOutline}`}>
                  {busy === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                  Continue with Google
                </button>

                <div className="my-5 flex items-center gap-3 text-xs text-(--s-muted)">
                  <span className="h-px flex-1 bg-(--s-line)" /> or with email <span className="h-px flex-1 bg-(--s-line)" />
                </div>
              </>
            )}

            {error && (
              <div className={mode === "forgot" ? "mt-5" : "mb-4"}>
                <Notice tone="error">{error}</Notice>
              </div>
            )}

            <form onSubmit={submit} className={`space-y-4 ${mode === "forgot" ? "mt-5" : ""}`} noValidate>
              {mode === "signup" && (
                <Field label="Your name">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Kamal Perera" />
                </Field>
              )}
              <Field label="Email">
                <input
                  className={inputCls}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
              {mode !== "forgot" && (
                <Field label="Password" hint={mode === "signup" ? "At least 6 characters." : undefined}>
                  <div className="relative">
                    <input
                      className={`${inputCls} pr-11`}
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-(--s-muted) hover:text-(--s-ink)"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              )}
              {mode === "login" && (
                <div className="-mt-1 text-right">
                  <button type="button" onClick={() => switchMode("forgot")} className="text-xs font-medium text-(--s-muted) hover:text-(--s-ink)">
                    Forgot password?
                  </button>
                </div>
              )}
              <button type="submit" disabled={!!busy} className={`w-full ${btnDark}`}>
                {busy === "form" && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
