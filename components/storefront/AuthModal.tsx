"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Lock, CheckCircle2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // 1-Click Google Login
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/checkout` : undefined,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  // Email login / register
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        onSuccess(data.user);
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Account created successfully!");
          onSuccess(data.user);
          onClose();
        } else {
          toast.success("Registration successful! Please check your email inbox to verify your account, or login.");
          setMode("login");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
            <span className="font-extrabold text-amber-600 text-lg">BK</span>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {mode === "login" ? "Sign In to BK Wiring Kade" : "Create Customer Account"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Please verify your identity before confirming your order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 flex items-center justify-center gap-3 border-slate-300 hover:bg-slate-50 font-medium"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative flex items-center justify-center text-xs uppercase text-slate-400">
            <div className="border-t w-full border-slate-200"></div>
            <span className="bg-white px-2 text-slate-400 font-medium">Or with Email</span>
            <div className="border-t w-full border-slate-200"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "register" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Full Name</label>
                  <Input
                    placeholder="e.g. Ruwan Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                  <Input
                    placeholder="e.g. 0771234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="mt-1 h-10"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 h-10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 h-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm mt-2 shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                "Sign In & Proceed"
              ) : (
                "Create Account & Proceed"
              )}
            </Button>
          </form>

          <div className="text-center pt-1 text-xs text-slate-500">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-amber-600 font-bold hover:underline"
                >
                  Create Account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-amber-600 font-bold hover:underline"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
