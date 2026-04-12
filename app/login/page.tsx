// app/login/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session-check");
        const data = await res.json();
        if (data.valid && data.redirectPath) {
          if (typeof window !== "undefined" && data.user) {
            localStorage.setItem("currentUser", JSON.stringify(data.user));
          }
          toast.success(`Welcome back, ${data.user?.name || ""}`);
          router.push(data.redirectPath);
          return;
        }
      } catch {
        // no saved session
      }
      setIsCheckingSession(false);
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, rememberMe }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");

      if (typeof window !== "undefined") {
        const userContext = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.role,
          businessId: data.business?.id || null,
          businessName: data.business?.name || null,
          businessDescription: data.business?.description || null,
          initials: data.user.name
            ? data.user.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
            : "U",
        };
        localStorage.setItem("currentUser", JSON.stringify(userContext));
      }

      toast.success(`Welcome back, ${data.user.name}`);

      if (data.role === "office" && data.business) {
        const bid = data.business.id;
        if (bid === BUSINESS_IDS.WIREMAN_AGENCY)        router.push("/dashboard/office/wireman");
        else if (bid === BUSINESS_IDS.ORANGE_AGENCY)    router.push("/dashboard/office/orange");
        else if (bid === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION) router.push("/dashboard/office/distribution");
        else if (bid === BUSINESS_IDS.SIERRA_AGENCY)    router.push("/dashboard/office/sierra");
        else if (bid === BUSINESS_IDS.CHAMPIKA_RETAIL)  router.push("/dashboard/office/retail");
        else                                             router.push("/dashboard/office");
      } else {
        switch (data.role) {
          case "office":      router.push("/dashboard/office"); break;
          case "rep":         router.push("/dashboard/rep");    break;
          case "delivery":    router.push("/dashboard/delivery"); break;
          case "admin":
          case "super_admin": router.push("/dashboard/admin");  break;
          default:            router.push("/dashboard");
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Session-check loading screen ────────────────────────────────────────
  if (isCheckingSession) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F4F4F2] relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-stone-300/40 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-2xl shadow-black/10 ring-4 ring-white bg-white">
            <img src="/logo.svg" alt="Logo" className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Login page ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F4F4F2] relative overflow-hidden font-sans text-gray-900">

      {/* Decorative background blobs */}
      <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-blue-100/50 blur-3xl pointer-events-none select-none" />
      <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full bg-stone-300/50 blur-3xl pointer-events-none select-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/20 blur-3xl pointer-events-none select-none" />

      {/* Logo watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
        <img src="/logo.svg" alt="" className="w-[85vw] max-w-[600px] opacity-[0.04]" />
      </div>

      {/* Content — vertically centered, scrollable on very short screens */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px] space-y-7">

          {/* ── Logo + title ── */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              {/* Glow ring behind logo */}
              <div className="absolute inset-0 rounded-2xl bg-black/5 blur-xl scale-110" />
              <div className="relative h-[72px] w-[72px] sm:h-20 sm:w-20 rounded-2xl overflow-hidden shadow-2xl shadow-black/15 ring-[3px] ring-white bg-white">
                <img src="/logo.svg" alt="Champika B2B Logo" className="h-full w-full object-cover" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-[26px] sm:text-3xl font-bold tracking-tight text-black leading-none">
                Champika B2B
              </h1>
              <p className="text-sm text-[#78716c] font-medium">Integrated Management Portal</p>
            </div>
          </div>

          {/* ── Card ── */}
          <div className="bg-white rounded-3xl border border-[#e8e5e3] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] p-7 sm:p-8 space-y-6">

            <div className="space-y-1">
              <h2 className="text-[17px] sm:text-lg font-semibold text-black">Sign in to your account</h2>
              <p className="text-sm text-[#78716c]">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">

              {/* Username / Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#292524]">
                  Username or Email
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="Enter your username or email"
                  className="h-12 sm:h-11 bg-[#FAFAF9] border-[#e7e5e4] focus-visible:ring-black focus-visible:border-black rounded-xl px-4 text-sm placeholder:text-[#c0bbb8]"
                  required
                  autoComplete="username"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-[#292524]">
                    Password
                  </Label>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toast.info("Please contact system administrator."); }}
                    className="text-xs font-medium text-[#a8a29e] hover:text-black transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-12 sm:h-11 bg-[#FAFAF9] border-[#e7e5e4] focus-visible:ring-black focus-visible:border-black rounded-xl px-4 pr-11 text-sm placeholder:text-[#c0bbb8]"
                    required
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c0bbb8] hover:text-[#57534e] transition-colors p-0.5"
                    tabIndex={-1}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-3 py-0.5">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 rounded border-[#d6d3d1] accent-black cursor-pointer shrink-0"
                />
                <label htmlFor="remember" className="text-sm text-[#57534e] cursor-pointer select-none">
                  Remember me for <span className="font-medium text-[#292524]">30 days</span>
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 sm:h-11 bg-black hover:bg-[#1c1c1c] text-white font-semibold rounded-xl text-[15px] shadow-lg shadow-black/10 transition-all active:scale-[0.98] mt-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Authenticating…</span>
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#f0eeec]" />
              <div className="flex items-center gap-1.5 text-[#c0bbb8]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wider">Authorized Personnel Only</span>
              </div>
              <div className="flex-1 h-px bg-[#f0eeec]" />
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] text-[#b8b2ae] pb-2">
            © 2025 Champika B2B System · All rights reserved
          </p>

        </div>
      </div>
    </div>
  );
}
