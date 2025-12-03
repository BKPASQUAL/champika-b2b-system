"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  ArrowRight,
  Loader2,
  ClipboardCheck,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

import { Order } from "../types";

export default function CheckingOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // --- 1. Fetch Checking Orders ---
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/orders?status=Checking");
        if (!res.ok) throw new Error("Failed to load checking orders");
        const data = await res.json();
        setOrders(data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // --- 2. Filter Logic ---
  const filteredOrders = orders.filter(
    (order) =>
      (order.invoiceNo &&
        order.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Checking Orders</h1>
          <p className="text-muted-foreground text-sm">
            Quality control and final item verification.
          </p>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Invoice, Order ID or Shop..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200"
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0 bg-white">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-0 sm:px-6 pt-0">
          {/* --- MOBILE VIEW: CARDS (md:hidden) --- */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <div className="flex flex-col items-center justify-center">
                  <ClipboardCheck className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p>No orders pending check.</p>
                </div>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 active:scale-[0.99] transition-transform"
                  onClick={() =>
                    router.push(`/dashboard/admin/orders/checking/${order.id}`)
                  }
                >
                  {/* Row 1: Invoice No, Date, Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-xs">
                        <FileText className="h-3 w-3" />
                        {order.invoiceNo || "N/A"}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({order.orderId})
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-purple-50 text-purple-700 border-purple-200 shrink-0"
                    >
                      Checking
                    </Badge>
                  </div>

                  {/* Row 2: Shop & Sales Rep */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {order.shopName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(order.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                      <User className="h-3 w-3" />
                      <span>{order.salesRep}</span>
                    </div>
                  </div>

                  {/* Row 3: Totals */}
                  <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2 mt-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Items</p>
                      <p className="font-medium">{order.itemCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Total Amount
                      </p>
                      <p className="font-bold text-slate-900">
                        LKR {order.totalAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Row 4: Action Button */}
                  <Button
                    size="sm"
                    className="w-full mt-1 bg-purple-600 hover:bg-purple-700 text-white h-9"
                  >
                    Check Order <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* --- DESKTOP VIEW: TABLE (hidden md:block) --- */}
          <div className="hidden md:block rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <ClipboardCheck className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p>No orders pending check.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-slate-50">
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {new Date(order.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium font-mono text-purple-700 text-xs flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {order.invoiceNo || "N/A"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {order.orderId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-slate-900">
                            {order.shopName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {order.customerName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.salesRep}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {order.itemCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        LKR {order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-700 border-purple-200"
                        >
                          Checking
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs"
                          onClick={() =>
                            router.push(
                              `/dashboard/admin/orders/checking/${order.id}`
                            )
                          }
                        >
                          Check <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
