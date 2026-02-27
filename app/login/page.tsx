// app/login/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sprout, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants"; // ✅ Imported Constants

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // --- SAVE USER DATA ---
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
            ? data.user.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase()
            : "U",
        };

        localStorage.setItem("currentUser", JSON.stringify(userContext));
      }
      // ---------------------

      toast.success(`Welcome back, ${data.user.name}`);

      // --- REDIRECT LOGIC ---
      if (data.role === "office" && data.business) {
        const businessName = data.business.name.toLowerCase();

        // 1. ✅ Check for Wireman Agency (ID Based - Best Practice)
        if (data.business.id === BUSINESS_IDS.WIREMAN_AGENCY) {
          router.push("/dashboard/office/wireman");
        }
        // 2. Check for Orange Agency (ID Based)
        else if (data.business.id === BUSINESS_IDS.ORANGE_AGENCY) {
          router.push("/dashboard/office/orange");
        }
        // 3. Check Distribution Center
        else if (
          businessName.includes("distribution") ||
          (businessName.includes("champika hardware") &&
            !businessName.includes("retail"))
        ) {
          router.push("/dashboard/office/distribution");
        }
        // 4. Check Retail Branch
        else if (businessName.includes("retail")) {
          router.push("/dashboard/office/retail");
        }
        // Fallback: Standard Office
        else {
          router.push("/dashboard/office");
        }
      } else {
        // Standard Role Routing
        switch (data.role) {
          case "office":
            router.push("/dashboard/office");
            break;
          case "rep":
            router.push("/dashboard/rep");
            break;
          case "delivery":
            router.push("/dashboard/delivery");
            break;
          case "admin":
          case "super_admin":
            router.push("/dashboard/admin");
            break;
          default:
            router.push("/dashboard");
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F5F5F4] p-4 font-sans text-gray-900">
      <div className="w-full max-w-[440px] space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-20 w-20 flex items-center justify-center rounded-2xl shadow-xl shadow-blue-900/10 overflow-hidden bg-white">
            <img src="/logo.svg" alt="Finora Farm Logo" className="h-full w-full object-cover" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-black">
              Champika B2B
            </h1>
            <p className="text-[#78716c]">Integrated Management Portal</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e7e5e4] p-8 md:p-10 space-y-8">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-black">Secure Sign In</h2>
            <p className="text-sm text-[#78716c]">
              Enter your credentials to access the system
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-black">
                Username or Email
              </Label>
              <Input
                id="email"
                type="text"
                placeholder="Enter your username or email"
                className="h-11 bg-white border-[#e7e5e4] focus-visible:ring-black focus-visible:border-black rounded-lg px-4"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-black"
                >
                  Password
                </Label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Please contact system administrator.");
                  }}
                  className="text-sm font-medium text-[#78716c] hover:text-black transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 bg-white border-[#e7e5e4] focus-visible:ring-black focus-visible:border-black rounded-lg px-4 pr-10"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#a8a29e] hover:text-[#57534e] transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              className="w-full h-11 bg-black hover:bg-[#262626] text-white font-medium rounded-lg text-[15px] shadow-lg shadow-black/5 transition-all active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#e7e5e4]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-[#a8a29e] tracking-wider font-medium">
                Authorized Personnel Only
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-[#a8a29e]">
          © 2025 Finora Farm B2B System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
