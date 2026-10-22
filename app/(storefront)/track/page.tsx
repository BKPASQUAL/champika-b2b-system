"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Search, ArrowRight, ShieldCheck, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function OrderTrackingSearchPage() {
  const router = useRouter();
  const [orderQuery, setOrderQuery] = useState("");

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderQuery.trim()) {
      toast.error("Please enter your Order Number (e.g. STO-0001)");
      return;
    }
    router.push(`/track/${orderQuery.trim()}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 space-y-8">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <Truck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Track Your Delivery
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Enter your <strong>BK Wiring Kade</strong> order reference to check real-time packaging, dispatch, and delivery status.
        </p>
      </div>

      <Card className="border-slate-200 shadow-md">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleTrack} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700">Order Reference Number</label>
              <div className="relative mt-1.5">
                <Input
                  placeholder="e.g. STO-0001"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  required
                  className="h-12 pl-10 text-sm font-bold tracking-wider uppercase border-slate-300 focus-visible:ring-amber-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Your order number was provided on your checkout confirmation and WhatsApp notification.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm rounded-xl shadow-md shadow-amber-600/20 gap-2"
            >
              Track Order Status
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-center space-y-2 text-xs text-slate-400">
        <p>Need assistance with your delivery?</p>
        <div className="font-bold text-slate-700 flex items-center justify-center gap-2">
          <Phone className="w-3.5 h-3.5 text-amber-600" />
          <span>Call Support: 0777681663 / 077-3151561</span>
        </div>
      </div>
    </div>
  );
}
