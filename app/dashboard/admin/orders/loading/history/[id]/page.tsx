// FILE PATH: app/dashboard/admin/orders/loading/history/[id]/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Edit,
  Loader2,
  Users,
  ShoppingBag,
  Printer,
  Download, // Added Download icon
} from "lucide-react";
import { toast } from "sonner";
import { downloadLoadingSheet, printLoadingSheet } from "../print-loading-sheet";
// Import both functions


// ... (Interfaces remain the same) ...
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

  // Action States
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ... (Edit form states remain same) ...
  const [editForm, setEditForm] = useState({
    lorryNumber: "",
    driverId: "",
    helperName: "",
    loadingDate: "",
    status: "",
  });
  const [lorries, setLorries] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<
    { id: string; fullName: string; role: string }[]
  >([]);

  // ... (useEffect for fetching data remains same) ...
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/loading/history/${id}`);
        if (!res.ok) throw new Error("Failed to fetch loading sheet");
        const data = await res.json();
        setLoadingSheet(data);

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

  // ... (loadEditOptions remains same) ...
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

  // --- NEW HANDLERS ---
  const handlePrint = async () => {
    if (!loadingSheet) return;
    setPrinting(true);
    await printLoadingSheet(loadingSheet.id);
    setPrinting(false);
  };

  const handleDownload = async () => {
    if (!loadingSheet) return;
    setDownloading(true);
    await downloadLoadingSheet(loadingSheet.id);
    setDownloading(false);
  };

  // ... (handleUpdateLoadingSheet remains same) ...
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

  if (!loadingSheet) return <div>Not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              })}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Edit Button */}
          <Button variant="outline" onClick={handleEditClick}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>

          {/* Download Button */}
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download
          </Button>

          {/* Print Button */}
          <Button variant="default" onClick={handlePrint} disabled={printing}>
            {printing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Printer className="w-4 h-4 mr-2" />
            )}
            Print
          </Button>
        </div>
      </div>

      {/* ... (Rest of the UI Cards for Stats, Vehicle Info, Orders List remain unchanged) ... */}

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
                  ? "bg-green-600"
                  : "bg-blue-600"
              }
            >
              {loadingSheet.status}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Info Grids */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vehicle & Personnel</CardTitle>
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
                  Driver
                </p>
                <p className="text-lg font-semibold">
                  {loadingSheet.driverName}
                </p>
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
          </CardContent>
        </Card>

        {/* Route Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Route Summary</CardTitle>
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
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSheet.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium font-mono">
                    {order.orderId}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {order.customer.shopName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.customer.address}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{order.salesRep}</TableCell>
                  <TableCell className="text-right font-semibold">
                    Rs. {order.totalAmount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog (Kept existing logic) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Lorry</Label>
              <Select
                value={editForm.lorryNumber}
                onValueChange={(val) =>
                  setEditForm({ ...editForm, lorryNumber: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lorries.map((l) => (
                    <SelectItem key={l.id} value={l.name}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Driver</Label>
              <Select
                value={editForm.driverId}
                onValueChange={(val) =>
                  setEditForm({ ...editForm, driverId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.role === "driver" || u.role === "delivery")
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Helper</Label>
              <Input
                value={editForm.helperName}
                onChange={(e) =>
                  setEditForm({ ...editForm, helperName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(val) =>
                  setEditForm({ ...editForm, status: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
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
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateLoadingSheet} disabled={updating}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
