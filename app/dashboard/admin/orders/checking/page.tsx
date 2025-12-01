"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  ArrowRight,
  Loader2,
  ClipboardCheck,
  Eye,
  Calendar,
  Building2,
  Package,
} from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checking Orders</h1>
          <p className="text-muted-foreground mt-1">
            Quality control and final item verification.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Order ID, Shop or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p>No orders pending check.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* --- MOBILE & TABLET VIEW (Cards) --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base font-bold">
                        {order.orderId}
                      </CardTitle>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Calendar className="mr-1 h-3 w-3" />
                        {new Date(order.date).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-purple-50 text-purple-700 border-purple-200 shrink-0"
                    >
                      Checking
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{order.shopName}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerName}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{order.itemCount} Items</span>
                    </div>
                    <div className="font-bold text-base">
                      LKR {order.totalAmount.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      router.push(`/dashboard/admin/orders/${order.id}`)
                    }
                  >
                    <Eye className="h-4 w-4 mr-2" /> View
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() =>
                      router.push(
                        `/dashboard/admin/orders/checking/${order.id}`
                      )
                    }
                  >
                    Check Order <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* --- DESKTOP VIEW (Table) --- */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer / Shop</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-center">QC Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium font-mono">
                          {order.orderId}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(order.date).toLocaleDateString()}
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
                        <TableCell className="text-right">
                          {order.itemCount}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
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
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                router.push(
                                  `/dashboard/admin/orders/${order.id}`
                                )
                              }
                              title="View Details"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>

                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() =>
                                router.push(
                                  `/dashboard/admin/orders/checking/${order.id}`
                                )
                              }
                            >
                              Check Order{" "}
                              <ArrowRight className="ml-2 h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
