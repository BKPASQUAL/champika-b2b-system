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

// Define the Order interface locally or import it
interface Order {
  id: string;
  orderId: string;
  shopName: string;
  route: string;
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

  // --- 1. Fetch Orders from API ---
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders/loading");
      if (!res.ok) throw new Error("Failed to fetch loading orders");
      const data = await res.json();
      setOrders(data);
      setSelectedOrders([]); // Reset selections on refresh
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

  // --- 2. Filter Logic ---
  const filteredOrders = orders.filter(
    (order) =>
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- 3. Selection Handlers ---
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

  // --- 4. Create Load Handler ---
  const handleCreateLoad = async (formData: any) => {
    try {
      // Find the driver ID based on the name selected in the dialog
      // Note: Ideally, your Dialog should return the ID directly.
      // For now, we assume the API needs an ID. You might need to fetch users to get the ID.
      // If your MOCK_DRIVERS has real IDs matching Supabase users, pass that.
      // Assuming formData.driver is the ID or you map it here.

      const payload = {
        lorryNumber: formData.lorryNumber,
        driverId: formData.driver, // Ensure this sends a UUID (e.g., User ID from profiles)
        helperName: formData.helper,
        loadingDate: formData.date,
        orderIds: selectedOrders,
      };

      // Since the mock dialog sends names, you might need to map them to IDs
      // or update the dialog to use IDs. For this example, we assume valid UUIDs
      // or you will need to fetch the driver list from /api/users first.

      // For demonstration, if we don't have a real UUID, the API will fail validation.
      // You should update LoadingSheetDialog to fetch drivers from /api/users.

      const res = await fetch("/api/orders/loading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to create load");

      toast.success(`Load Sheet ${result.loadId} Created!`);

      // Refresh Data
      fetchOrders();
      router.push("/dashboard/admin/orders/loading/history");
    } catch (error: any) {
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading orders...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
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
                          {order.route}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">
                          {order.shopName}
                        </span>
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
