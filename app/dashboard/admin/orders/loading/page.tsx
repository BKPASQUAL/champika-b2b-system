// FILE PATH: app/dashboard/admin/orders/loading/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  Search,
  Filter,
  Truck,
  History,
  PlusCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSheetDialog } from "../_components/LoadingSheetDialog";

interface Order {
  id: string;
  orderId: string;
  shopName: string;
  route: string;
  salesRepName: string;
  totalAmount: number;
  status: string;
}

export default function LoadingOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders/loading");
      if (!res.ok) throw new Error("Failed to fetch loading orders");
      const data = await res.json();
      setOrders(data);
      setSelectedOrders([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter(
    (order) =>
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.salesRepName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleCreateLoad = async (formData: any) => {
    try {
      const payload = {
        lorryNumber: formData.lorryNumber,
        driverId: formData.driverId,
        helperName: formData.helperName || "",
        date: formData.date,
        orderIds: selectedOrders,
      };

      console.log("Sending payload to API:", payload);

      const res = await fetch("/api/orders/loading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("API Error Response:", result);
        throw new Error(result.error || "Failed to create load");
      }

      toast.success(`Load Sheet ${result.loadId} Created!`);

      fetchOrders();
      router.push("/dashboard/admin/orders/loading/history");
    } catch (error: any) {
      console.error("Create Load Error:", error);
      toast.error(error.message);
    }
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
            size="icon"
            onClick={fetchOrders}
            title="Refresh"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
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
                placeholder="Search Order ID, Shop, or Sales Rep..."
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
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-right">Total Bill</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading orders...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-12 w-12 text-muted-foreground/30" />
                        <p className="font-medium">
                          No orders ready for loading
                        </p>
                        <p className="text-sm">
                          Orders will appear here once they pass quality checks
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.orderId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {order.route}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.shopName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {order.salesRepName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">{order.salesRepName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        Rs. {order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-600 hover:bg-blue-700">
                          {order.status}
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
