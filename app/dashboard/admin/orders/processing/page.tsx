// app/dashboard/admin/orders/processing/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  PackageCheck,
  Eye
} from "lucide-react";

import { Order } from "../types";
import { MOCK_ALL_ORDERS } from "../data";

export default function ProcessingOrdersPage() {
  const router = useRouter();
  
  // 1. Filter for 'Processing' orders only
  const [orders, setOrders] = useState<Order[]>(
    MOCK_ALL_ORDERS.filter((o) => o.status === "Processing")
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // 2. Filter Logic
  const filteredOrders = orders.filter(
    (order) =>
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 3. Handle "Move to Checking" Action
  const handleMoveToChecking = (orderId: string) => {
    if (confirm("Confirm order is processed and ready for checking?")) {
        setLoadingId(orderId);
        
        // Simulate API call
        setTimeout(() => {
            // Remove from this list (optimistic update)
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            setLoadingId(null);
            // In real app, you'd trigger a refresh or toast here
            alert(`Order ${filteredOrders.find(o => o.id === orderId)?.orderId} moved to Checking.`);
        }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processing Orders</h1>
          <p className="text-muted-foreground mt-1">
            Orders currently being picked and packed.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Order ID, Shop or Customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center">
                         <PackageCheck className="h-12 w-12 text-muted-foreground/20 mb-4" />
                         <p>No orders in processing.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
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
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          Processing
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            {/* View Details */}
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => router.push(`/dashboard/admin/orders/${order.id}`)}
                                title="View Details"
                            >
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>

                            {/* Approve / Move Next */}
                            <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => handleMoveToChecking(order.id)}
                            disabled={loadingId === order.id}
                            >
                            {loadingId === order.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <>
                                Send to Checking <ArrowRight className="ml-2 h-3 w-3" />
                                </>
                            )}
                            </Button>
                        </div>
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