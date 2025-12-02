"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, ArrowRight, Loader2, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

import { Order } from "../../orders/types"; // Adjust path if needed based on folder structure

export default function OfficePendingOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Fetch Data ---
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/orders?status=Pending");
        if (!res.ok) throw new Error("Failed to load pending orders");
        const data = await res.json();
        setOrders(data);
      } catch (error) {
        console.error(error);
        toast.error("Error loading pending orders");
      } finally {
        setLoading(false);
      }
    };

    fetchPendingOrders();
  }, []);

  // --- Filter Logic ---
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      order.orderId.toLowerCase().includes(searchLower) ||
      order.shopName.toLowerCase().includes(searchLower) ||
      order.customerName.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-0">
      {/* Header Section - Stacks on Mobile */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Pending Orders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Office Portal: Review and approve new orders.
          </p>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Order ID, Shop..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 hidden sm:flex"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {/* Mobile View: Card List */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending orders.
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-blue-700">
                        {order.orderId}
                      </span>
                      <p className="text-sm font-semibold mt-1">
                        {order.shopName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerName}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-yellow-50 text-yellow-700 border-yellow-200 shrink-0"
                    >
                      Pending
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-2 border-t pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p>{new Date(order.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-bold">
                        LKR {order.totalAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() =>
                      router.push(`/dashboard/office/orders/${order.id}`)
                    }
                  >
                    Review Order <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Tablet/Desktop View: Table */}
          <div className="hidden md:block rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Sales Rep
                  </TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No pending orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(order.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium font-mono text-blue-700">
                        {order.orderId}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {order.shopName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {order.customerName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {order.salesRep}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.itemCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        LKR {order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 text-yellow-700 border-yellow-200"
                        >
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() =>
                            router.push(`/dashboard/office/orders/${order.id}`)
                          }
                        >
                          Review <ArrowRight className="ml-2 h-3 w-3" />
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
