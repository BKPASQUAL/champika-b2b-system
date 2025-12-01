// FILE PATH: app/dashboard/admin/orders/loading/history/[id]/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Truck,
  User,
  Calendar,
  Package,
  MapPin,
  Phone,
  FileText,
  Edit,
  Loader2,
  Users,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

interface LoadingSheetDetail {
  id: string;
  loadId: string;
  lorryNumber: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverPhone: string;
  helperName: string;
  loadingDate: string;
  status: string;
  createdAt: string;
  totalOrders: number;
  totalAmount: number;
  totalItems: number;
  orders: Array<{
    id: string;
    orderId: string;
    totalAmount: number;
    status: string;
    customer: {
      shopName: string;
      ownerName: string;
      phone: string;
      address: string;
      route: string;
    };
    salesRep: string;
    itemCount: number;
    totalQuantity: number;
    items: Array<{
      productName: string;
      sku: string;
      quantity: number;
      freeQuantity: number;
    }>;
  }>;
}

export default function LoadingSheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loadingSheet, setLoadingSheet] = useState<LoadingSheetDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    lorryNumber: "",
    driverId: "",
    helperName: "",
    loadingDate: "",
    status: "",
  });

  // Available options for edit
  const [lorries, setLorries] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<
    { id: string; fullName: string; role: string }[]
  >([]);

  // Fetch loading sheet details
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/loading/history/${id}`);
        if (!res.ok) throw new Error("Failed to fetch loading sheet");
        const data = await res.json();
        setLoadingSheet(data);

        // Set edit form with current values
        setEditForm({
          lorryNumber: data.lorryNumber,
          driverId: data.driverId,
          helperName: data.helperName || "",
          loadingDate: data.loadingDate,
          status: data.status,
        });
      } catch (error) {
        console.error(error);
        toast.error("Failed to load loading sheet details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  // Fetch lorries and users for edit dialog
  const loadEditOptions = async () => {
    try {
      const [lorryRes, userRes] = await Promise.all([
        fetch("/api/settings/categories?type=lorry"),
        fetch("/api/users"),
      ]);

      if (lorryRes.ok) setLorries(await lorryRes.json());
      if (userRes.ok) setUsers(await userRes.json());
    } catch (error) {
      toast.error("Failed to load edit options");
    }
  };

  const handleEditClick = () => {
    loadEditOptions();
    setIsEditDialogOpen(true);
  };

  const handleUpdateLoadingSheet = async () => {
    try {
      setUpdating(true);

      const payload = {
        lorryNumber: editForm.lorryNumber,
        driverId: editForm.driverId,
        helperName: editForm.helperName,
        loadingDate: editForm.loadingDate,
        status: editForm.status,
      };

      const res = await fetch(`/api/orders/loading/history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update");
      }

      toast.success("Loading sheet updated successfully!");
      setIsEditDialogOpen(false);

      // Refresh data
      const refreshRes = await fetch(`/api/orders/loading/history/${id}`);
      const refreshedData = await refreshRes.json();
      setLoadingSheet(refreshedData);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">
          Loading details...
        </p>
      </div>
    );
  }

  if (!loadingSheet) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <Truck className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-xl font-semibold text-muted-foreground">
          Loading sheet not found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Loading Sheet
              <Badge className="text-base font-mono px-3">
                {loadingSheet.loadId}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              Created on{" "}
              {new Date(loadingSheet.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEditClick}>
            <Edit className="w-4 h-4 mr-2" /> Edit Details
          </Button>
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingSheet.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {loadingSheet.totalItems} items total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {loadingSheet.totalAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined order value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Truck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                loadingSheet.status === "Completed" ? "default" : "secondary"
              }
              className={
                loadingSheet.status === "Completed"
                  ? "bg-green-600 hover:bg-green-700 text-base px-3 py-1"
                  : "bg-blue-600 hover:bg-blue-700 text-white text-base px-3 py-1"
              }
            >
              {loadingSheet.status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {loadingSheet.status === "Completed"
                ? "Delivery completed"
                : "Currently in transit"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loading Sheet Information */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Vehicle & Personnel */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle & Personnel</CardTitle>
            <CardDescription>Delivery team information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Vehicle
                </p>
                <p className="text-lg font-semibold">
                  {loadingSheet.lorryNumber}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Responsible Person (Driver)
                </p>
                <p className="text-lg font-semibold">
                  {loadingSheet.driverName}
                </p>
                {loadingSheet.driverPhone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />
                    {loadingSheet.driverPhone}
                  </p>
                )}
              </div>
            </div>

            {loadingSheet.helperName && (
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Helper
                  </p>
                  <p className="text-lg font-semibold">
                    {loadingSheet.helperName}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Loading Date
                </p>
                <p className="text-lg font-semibold">
                  {new Date(loadingSheet.loadingDate).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Route Summary</CardTitle>
            <CardDescription>Delivery locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from(
                new Set(loadingSheet.orders.map((o) => o.customer.route))
              ).map((route) => {
                const routeOrders = loadingSheet.orders.filter(
                  (o) => o.customer.route === route
                );
                return (
                  <div
                    key={route}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="font-medium">{route}</span>
                    </div>
                    <Badge variant="outline">{routeOrders.length} orders</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders in This Load</CardTitle>
          <CardDescription>
            Complete list of {loadingSheet.totalOrders} orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSheet.orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium font-mono">
                      {order.orderId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {order.customer.shopName}
                        </span>
                        {order.customer.ownerName && (
                          <span className="text-xs text-muted-foreground">
                            {order.customer.ownerName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.customer.route}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                          {order.salesRep.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{order.salesRep}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{order.totalQuantity}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      Rs. {order.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{order.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Loading Sheet</DialogTitle>
            <DialogDescription>
              Update vehicle, personnel, or status information
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Lorry */}
            <div className="grid gap-2">
              <Label>Vehicle / Lorry</Label>
              <Select
                value={editForm.lorryNumber}
                onValueChange={(val) =>
                  setEditForm({ ...editForm, lorryNumber: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {lorries.map((lorry) => (
                    <SelectItem key={lorry.id} value={lorry.name}>
                      {lorry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver */}
            <div className="grid gap-2">
              <Label>Responsible Person (Driver)</Label>
              <Select
                value={editForm.driverId}
                onValueChange={(val) =>
                  setEditForm({ ...editForm, driverId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.role === "driver")
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Helper */}
            <div className="grid gap-2">
              <Label>Helper (Optional)</Label>
              <Input
                value={editForm.helperName}
                onChange={(e) =>
                  setEditForm({ ...editForm, helperName: e.target.value })
                }
                placeholder="Enter helper name"
              />
            </div>

            {/* Loading Date */}
            <div className="grid gap-2">
              <Label>Loading Date</Label>
              <Input
                type="date"
                value={editForm.loadingDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, loadingDate: e.target.value })
                }
              />
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(val) =>
                  setEditForm({ ...editForm, status: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Transit">In Transit</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateLoadingSheet} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
