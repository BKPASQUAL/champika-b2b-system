"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Lock,
  ArrowRight,
  User,
  Phone,
  MapPin,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useStorefrontCart } from "@/hooks/useStorefrontCart";
import { AuthModal } from "@/components/storefront/AuthModal";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTotal, clearCart, isLoaded } = useStorefrontCart();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "BANK_TRANSFER">("COD");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setCustomerEmail(session.user.email || "");
        setCustomerName(session.user.user_metadata?.full_name || "");
        setCustomerPhone(session.user.user_metadata?.phone || "");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setCustomerEmail(session.user.email || "");
        setCustomerName(session.user.user_metadata?.full_name || "");
        setCustomerPhone(session.user.user_metadata?.phone || "");
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const deliveryFee = 0; // Free delivery or standard
  const grandTotal = cartTotal + deliveryFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enforce verified user login right before ordering
    if (!currentUser) {
      toast.info("Please sign in or register before confirming your order.");
      setAuthModalOpen(true);
      return;
    }

    if (!customerName || !customerPhone || !deliveryAddress) {
      toast.error("Please fill in your name, phone number, and delivery address.");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/storefront/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          customerName,
          customerPhone,
          customerEmail: currentUser.email || customerEmail,
          deliveryAddress,
          items: cart.map((i) => ({
            productId: i.id,
            sku: i.sku,
            title: i.title,
            price: i.price,
            quantity: i.quantity,
            unit: i.unit,
            total: i.price * i.quantity,
          })),
          subTotal: cartTotal,
          deliveryFee,
          grandTotal,
          paymentMethod,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order.");

      clearCart();
      toast.success(`Order #${data.orderNo} placed successfully!`);
      router.push(`/track/${data.orderNo}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoaded && cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Truck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Your Cart is Empty</h2>
        <p className="text-xs text-slate-500">
          Please add electrical wiring items, switches, or breakers to your cart before proceeding to checkout.
        </p>
        <Link href="/products">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-10 px-6 rounded-xl">
            Explore Products
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Secure Order Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your items and enter delivery details &bull; Verified customer checkout
        </p>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Customer details & payment method */}
        <div className="lg:col-span-7 space-y-6">
          {/* Auth Banner */}
          {!currentUser ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-900">Login Required to Complete Order</div>
                <div className="text-[11px] text-amber-700">
                  Sign in with Google or Email to verify your order and enable real-time tracking.
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setAuthModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0"
              >
                Sign In Now
              </Button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-900">
                  Logged in as: {currentUser.email}
                </span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">Verified Account</Badge>
            </div>
          )}

          {/* Delivery Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                1. Delivery &amp; Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Recipient Name *</label>
                  <Input
                    placeholder="e.g. Kasun Silva"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="mt-1 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Contact Phone Number *</label>
                  <Input
                    placeholder="e.g. 0771234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    className="mt-1 h-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Full Delivery Address *</label>
                <Textarea
                  placeholder="House number, street address, town, and landmark for delivery driver"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                  className="mt-1 text-xs resize-none h-20"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Special Delivery Instructions (Optional)</label>
                <Input
                  placeholder="e.g. Call before delivery, deliver after 2 PM"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-10 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                2. Choose Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(val: any) => setPaymentMethod(val)}
                className="space-y-3"
              >
                {/* Cash on Delivery */}
                <div
                  onClick={() => setPaymentMethod("COD")}
                  className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    paymentMethod === "COD" ? "border-amber-500 bg-amber-50/20" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <RadioGroupItem value="COD" id="cod" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="cod" className="font-bold text-sm text-slate-900 cursor-pointer">
                      Cash on Delivery (COD)
                    </Label>
                    <p className="text-xs text-slate-500">
                      Pay cash directly to the delivery driver upon receiving and inspecting your electrical supplies.
                    </p>
                  </div>
                </div>

                {/* Direct Bank Transfer */}
                <div
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    paymentMethod === "BANK_TRANSFER" ? "border-amber-500 bg-amber-50/20" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <RadioGroupItem value="BANK_TRANSFER" id="bank" className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor="bank" className="font-bold text-sm text-slate-900 cursor-pointer">
                      Direct Bank Transfer / Online Banking
                    </Label>
                    <p className="text-xs text-slate-500">
                      Transfer directly to our official bank account. You can send the slip via WhatsApp after placing the order.
                    </p>
                    {paymentMethod === "BANK_TRANSFER" && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1 text-slate-700">
                        <div className="font-bold text-slate-900">Bank Account Details:</div>
                        <div>Bank: <strong>Commercial Bank of Ceylon</strong></div>
                        <div>Account Name: <strong>BK Wiring Kade</strong></div>
                        <div>Account No: <strong>1000-4829-1024</strong></div>
                        <div>Branch: <strong>Galle City Branch</strong></div>
                      </div>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="sticky top-24 border-slate-300 shadow-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-slate-900">Order Summary</CardTitle>
              <CardDescription className="text-xs">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} items in order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Itemized List */}
              <div className="max-h-60 overflow-y-auto space-y-2.5 divide-y divide-slate-100 pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="pt-2 first:pt-0 flex justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.quantity} {item.unit} &times; LKR {fmt(item.price)}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900 shrink-0">
                      LKR {fmt(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">LKR {fmt(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee</span>
                  <span className="font-bold text-emerald-600">FREE Delivery</span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Grand Total</span>
                  <span className="text-xl font-black text-slate-900">LKR {fmt(grandTotal)}</span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-600/20 gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Confirm &amp; Place Order
              </Button>

              <div className="text-[11px] text-slate-400 text-center leading-relaxed flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>BK WIRING KADE &bull; Real-time order tracking enabled</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Auth Modal Trigger if guest tries to place order */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setCustomerEmail(user.email || "");
          setCustomerName(user.user_metadata?.full_name || "");
          setCustomerPhone(user.user_metadata?.phone || "");
        }}
      />
    </div>
  );
}
