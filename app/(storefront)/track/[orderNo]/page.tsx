"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Truck,
  CheckCircle2,
  Clock,
  Package,
  FileText,
  Phone,
  Send,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Printer,
  Calendar,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrderTrackingDetailPage() {
  const params = useParams();
  const orderNo = params?.orderNo as string;

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNo) return;
    setLoading(true);
    fetch(`/api/storefront/public/track/${orderNo}`)
      .then((res) => {
        if (!res.ok) throw new Error("Order not found");
        return res.json();
      })
      .then((data) => setOrder(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderNo]);

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="py-24 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <p className="text-xs text-slate-500 font-medium">Fetching live order status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
        <p className="text-xs text-slate-500">
          We could not find any order matching <strong>&ldquo;{orderNo}&rdquo;</strong>. Please check your order number from your confirmation message.
        </p>
        <Link href="/track">
          <Button variant="outline" className="text-xs gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Tracking Search
          </Button>
        </Link>
      </div>
    );
  }

  // 5 Step Lifecycle
  const steps = [
    { step: 1, title: "Order Placed", desc: "Received online" },
    { step: 2, title: "Confirmed", desc: "Verified by office" },
    { step: 3, title: "Packing Supplies", desc: "Wires cut & packed" },
    { step: 4, title: "Dispatched", desc: "With delivery lorry" },
    { step: 5, title: "Delivered", desc: "Completed" },
  ];

  const currentStep = order.currentStep || 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <Link href="/track" className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Track Another Order
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Order #{order.orderNo}
            </h1>
            <Badge
              className={`text-xs font-bold uppercase ${
                order.orderStatus === "Delivered"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : order.orderStatus === "Dispatched"
                  ? "bg-purple-100 text-purple-800 border-purple-300"
                  : order.orderStatus === "Processing"
                  ? "bg-blue-100 text-blue-800 border-blue-300"
                  : "bg-amber-100 text-amber-800 border-amber-300"
              }`}
            >
              {order.orderStatus}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString()} &bull; Recipient: {order.customerName}
          </p>
        </div>

        {/* Action Buttons: Invoice PDF download */}
        <div className="flex items-center gap-2">
          {order.invoiceId ? (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 rounded-xl gap-2 shadow-sm"
              onClick={() => window.open(`/invoice/${order.invoiceId}?division=online`, "_blank")}
            >
              <Printer className="w-4 h-4" />
              Download Invoice ({order.invoiceNo || "CHO"})
            </Button>
          ) : (
            <Badge variant="outline" className="text-xs text-slate-500 py-1.5 px-3">
              Invoice preparing...
            </Badge>
          )}
        </div>
      </div>

      {/* Visual Stepper Card */}
      <Card className="border-slate-200 shadow-sm p-6 sm:p-8">
        <h3 className="text-sm font-bold text-slate-900 mb-6">Delivery Progress</h3>
        
        <div className="relative">
          {/* Connecting Line */}
          <div className="hidden sm:block absolute top-5 left-6 right-6 h-1 bg-slate-100 z-0">
            <div
              className="h-1 bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, ((currentStep - 1) / (steps.length - 1)) * 100))}%` }}
            ></div>
          </div>

          {/* Stepper items */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative z-10">
            {steps.map((s) => {
              const isCompleted = s.step < currentStep || order.orderStatus === "Delivered";
              const isCurrent = s.step === currentStep && order.orderStatus !== "Delivered";

              return (
                <div key={s.step} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      isCompleted
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : isCurrent
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20 animate-pulse"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : s.step}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isCurrent ? "text-amber-600" : isCompleted ? "text-slate-900" : "text-slate-400"}`}>
                      {s.title}
                    </div>
                    <div className="text-[10px] text-slate-400">{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Courier & Delivery Notice */}
        {order.courierOrLorry && (
          <div className="mt-8 p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-purple-900">
                  Assigned Delivery: {order.courierOrLorry}
                </div>
                {order.trackingNumber && (
                  <div className="text-[11px] text-purple-700 font-medium">
                    Tracking Ref: {order.trackingNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Order Details & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Item Breakdown */}
        <div className="md:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                Electrical Supplies Ordered
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 divide-y divide-slate-100">
              {(order.items || []).map((item: any, idx: number) => (
                <div key={idx} className="py-2.5 first:pt-0 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{item.title || item.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {item.quantity} {item.unit || "Pcs"} &times; LKR {fmt(item.price)}
                    </div>
                  </div>
                  <div className="font-extrabold text-slate-900">
                    LKR {fmt(item.total || item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Delivery Details */}
        <div className="md:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block">Recipient:</span>
                <span className="font-bold text-slate-900">{order.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Delivery Address:</span>
                <span className="font-medium text-slate-800 leading-relaxed">{order.deliveryAddress}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Method:</span>
                <span className="font-bold text-slate-900 uppercase">{order.paymentMethod}</span>
              </div>

              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-900">LKR {fmt(order.subTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery:</span>
                  <span className="font-bold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t">
                  <span>Grand Total:</span>
                  <span>LKR {fmt(order.grandTotal)}</span>
                </div>
              </div>

              {/* Support button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs gap-1.5 text-slate-700"
                  onClick={() => {
                    window.open(
                      `https://wa.me/94777681663?text=${encodeURIComponent(
                        `Hello BK Wiring Kade, I am inquiring about my order #${order.orderNo}`
                      )}`,
                      "_blank"
                    );
                  }}
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  WhatsApp Delivery Help Desk
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
