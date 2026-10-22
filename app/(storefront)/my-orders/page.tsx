"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Truck,
  ExternalLink,
  Printer,
  Calendar,
  Loader2,
  ArrowRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function MyOrdersPage() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchMyOrders(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchMyOrders = async (userId: string, email?: string) => {
    try {
      let query = supabase
        .from("storefront_orders")
        .select(`
          *,
          invoices (
            id,
            invoice_no
          )
        `)
        .order("created_at", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      } else if (email) {
        query = query.eq("customer_email", email);
      }

      const { data, error } = await query;
      if (!error && data) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Error fetching my orders", err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Sign In to View Orders</h2>
        <p className="text-xs text-slate-500">
          Please sign in to your BK Wiring Kade account to view your past electrical orders and invoices.
        </p>
        <Link href="/">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-10 px-6 rounded-xl">
            Return to Store
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          My Past Orders
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Account: {currentUser.email} &bull; Real-time delivery status and invoice downloads
        </p>
      </div>

      {orders.length === 0 ? (
        <Card className="text-center py-16 p-6 space-y-3">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">No orders placed yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Explore our certified house wiring cables, modular switches, and breakers.
          </p>
          <Link href="/products">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs">
              Start Shopping
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden border border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">#{order.order_no}</span>
                    <Badge
                      className={`text-[10px] font-bold ${
                        order.order_status === "Delivered"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.order_status === "Dispatched"
                          ? "bg-purple-100 text-purple-800"
                          : order.order_status === "Processing"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {order.order_status}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(order.created_at).toLocaleDateString()} &bull; {(order.items || []).length} items
                  </div>
                  <div className="text-xs font-bold text-slate-800 pt-1">
                    Total: LKR {fmt(order.grand_total)} ({order.payment_method})
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/track/${order.order_no}`}>
                    <Button variant="outline" size="sm" className="h-9 text-xs font-bold gap-1 text-slate-700">
                      <Truck className="w-3.5 h-3.5 text-amber-600" />
                      Track Delivery
                    </Button>
                  </Link>

                  {order.invoice_id && (
                    <Button
                      size="sm"
                      className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      onClick={() => window.open(`/invoice/${order.invoice_id}?division=online`, "_blank")}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Invoice PDF
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
