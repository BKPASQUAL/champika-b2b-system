"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Truck, History, PlusCircle } from "lucide-react";
import { Order } from "../types";
import { MOCK_ALL_ORDERS } from "../data";
import { LoadingSheetDialog } from "../_components/LoadingSheetDialog";



export default function LoadingOrdersPage() {
  const router = useRouter();

  // 1. Filter for 'Loading' orders
  const [orders, setOrders] = useState<Order[]>(
    MOCK_ALL_ORDERS.filter((o) => o.status === "Loading")
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 2. Filter Logic
  const filteredOrders = orders.filter(
    (order) =>
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 3. Handle Checkbox Selection
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id));
    }
  };

  // 4. Handle Load Creation
  const handleCreateLoad = (data: any) => {
    // In a real app: POST to API to create Load and update Orders
    console.log("Creating load with:", { ...data, orders: selectedOrders });

    // Optimistic Update: Remove selected orders
    setOrders((prev) => prev.filter((o) => !selectedOrders.includes(o.id)));
    setSelectedOrders([]);

    alert("Loading Sheet Created! Orders marked as Completed.");
    router.push("/dashboard/admin/orders/loading/history"); // Redirect to history
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loading Orders</h1>
          <p className="text-muted-foreground mt-1">
            Select orders to create a delivery load.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push("/dashboard/admin/orders/loading/history")
            }
          >
            <History className="w-4 h-4 mr-2" /> Delivery History
          </Button>

          {selectedOrders.length > 0 && (
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="animate-in fade-in zoom-in duration-300"
            >
              <PlusCircle className="w-4 h-4 mr-2" /> Create Load (
              {selectedOrders.length})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Order ID, Shop..."
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
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredOrders.length > 0 &&
                        selectedOrders.length === filteredOrders.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Route / Area</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total Bill</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Truck className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p>No orders ready for loading.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className={
                        selectedOrders.includes(order.id) ? "bg-muted/50" : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium font-mono">
                        {order.orderId}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100">
                          Galle Town
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {order.shopName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        LKR {order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          Ready to Load
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LoadingSheetDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedCount={selectedOrders.length}
        onConfirm={handleCreateLoad}
      />
    </div>
  );
}
