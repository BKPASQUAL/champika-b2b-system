// app/dashboard/admin/orders/loading/history/[id]/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Edit,
  Loader2,
  ShoppingBag,
  Printer,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  X,
  Plus,
  Truck,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadLoadingSheet,
  printLoadingSheet,
} from "../print-loading-sheet";

interface OrderDetail {
  id: string;
  orderId: string;
  invoiceNo: string;
  totalAmount: number;
  originalAmount?: number;
  status: string;
  customer: {
    shopName: string;
    ownerName: string;
    phone: string;
    address: string;
    route: string;
  };
  salesRep: { name: string };
}

interface AvailableOrder {
  id: string;
  orderId: string;
  invoiceNo?: string;
  shopName: string;
  route: string;
  salesRepName: string;
  totalAmount: number;
}

interface LoadingSheetDetail {
  id: string;
  loadId: string;
  lorryNumber: string;
  driverId: string;
  driverName: string;
  helperName: string;
  loadingDate: string;
  status: string;
  createdAt: string;
  totalOrders: number;
  totalAmount: number;
  totalItems: number;
  orders: OrderDetail[];
}

export default function LoadingSheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loadingSheet, setLoadingSheet] = useState<LoadingSheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [removingOrderId, setRemovingOrderId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; shopName: string; invoiceNo: string } | null>(null);
  const [removeStage, setRemoveStage] = useState("Loading");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedAddIds, setSelectedAddIds] = useState<string[]>([]);
  const [addingBusy, setAddingBusy] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  const [changeLorryOpen, setChangeLorryOpen] = useState(false);
  const [newLorry, setNewLorry] = useState("");
  const [changeLorryBusy, setChangeLorryBusy] = useState(false);

  const [stageMoveBusy, setStageMoveBusy] = useState(false);

  const [editForm, setEditForm] = useState({
    lorryNumber: "",
    driverId: "",
    helperName: "",
    loadingDate: "",
    status: "",
  });
  const [lorries, setLorries] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string; role: string }[]>([]);

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
      toast.error("Failed to load loading sheet details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetails(); }, [id]);

  const loadEditOptions = async () => {
    try {
      const [lorryRes, userRes] = await Promise.all([
        fetch("/api/settings/categories?type=lorry"),
        fetch("/api/users"),
      ]);
      if (lorryRes.ok) setLorries(await lorryRes.json());
      if (userRes.ok) setUsers(await userRes.json());
    } catch {
      toast.error("Failed to load edit options");
    }
  };

  const handleEditClick = () => {
    loadEditOptions();
    setIsEditDialogOpen(true);
  };

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

  const handleUpdateLoadingSheet = async () => {
    try {
      setUpdating(true);
      const res = await fetch(`/api/orders/loading/history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update");
      }
      toast.success("Loading sheet updated!");
      setIsEditDialogOpen(false);
      await fetchDetails();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const confirmRemoveOrder = async () => {
    if (!removeTarget) return;
    setRemovingOrderId(removeTarget.id);
    try {
      const res = await fetch(
        `/api/orders/loading/history/${id}/orders/${removeTarget.id}?status=${encodeURIComponent(removeStage)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove order");
      toast.success(`Order moved back to ${removeStage}.`);
      setRemoveTarget(null);
      await fetchDetails();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRemovingOrderId(null);
    }
  };

  const openAddDialog = async () => {
    setAddDialogOpen(true);
    setSelectedAddIds([]);
    setAddSearch("");
    setLoadingAvailable(true);
    try {
      const res = await fetch("/api/orders/loading");
      if (res.ok) setAvailableOrders(await res.json());
    } catch {
      toast.error("Failed to load available orders");
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleAddOrders = async () => {
    if (selectedAddIds.length === 0) return;
    setAddingBusy(true);
    try {
      const res = await fetch(`/api/orders/loading/history/${id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedAddIds }),
      });
      if (!res.ok) throw new Error("Failed to add orders");
      toast.success(`${selectedAddIds.length} order(s) added to loading sheet.`);
      setAddDialogOpen(false);
      await fetchDetails();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingBusy(false);
    }
  };

  const openChangeLorry = async () => {
    if (lorries.length === 0) {
      const res = await fetch("/api/settings/categories?type=lorry");
      if (res.ok) setLorries(await res.json());
    }
    setNewLorry(loadingSheet?.lorryNumber ?? "");
    setChangeLorryOpen(true);
  };

  const handleChangeLorry = async () => {
    if (!newLorry) { toast.error("Select a lorry."); return; }
    setChangeLorryBusy(true);
    try {
      const res = await fetch(`/api/orders/loading/history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lorryNumber: newLorry }),
      });
      if (!res.ok) throw new Error("Failed to change lorry");
      toast.success(`Lorry changed to ${newLorry}.`);
      setChangeLorryOpen(false);
      await fetchDetails();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChangeLorryBusy(false);
    }
  };

  const handleMoveStage = async (newStatus: "In Transit" | "Completed") => {
    setStageMoveBusy(true);
    try {
      const res = await fetch(`/api/orders/loading/history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Marked as ${newStatus}.`);
      await fetchDetails();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setStageMoveBusy(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
        return <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Delivered</Badge>;
      case "Cancelled":
        return <Badge className="bg-red-600 hover:bg-red-700"><XCircle className="w-3 h-3 mr-1" /> Returned</Badge>;
      case "Loading":
        return <Badge className="bg-orange-500 hover:bg-orange-600"><RefreshCw className="w-3 h-3 mr-1" /> Rescheduled</Badge>;
      case "In Transit":
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Send className="w-3 h-3 mr-1" /> In Transit</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredAvailable = availableOrders.filter((o) => {
    const q = addSearch.toLowerCase();
    return !q || o.shopName.toLowerCase().includes(q) || (o.invoiceNo ?? "").toLowerCase().includes(q) || o.orderId.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!loadingSheet) return <div>Not found</div>;

  const totalSentValue = loadingSheet.orders.reduce((sum, o) => sum + (o.originalAmount || o.totalAmount || 0), 0);
  const totalFinalValue = loadingSheet.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalDiff = totalFinalValue - totalSentValue;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Loading Sheet
              <Badge className="text-base font-mono px-3">{loadingSheet.loadId}</Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              Created on {new Date(loadingSheet.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {loadingSheet.status === "In Transit" && (
            <Button
              onClick={() => handleMoveStage("Completed")}
              disabled={stageMoveBusy}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {stageMoveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Mark Completed
            </Button>
          )}
          {loadingSheet.status === "Completed" && (
            <Button
              onClick={() => handleMoveStage("In Transit")}
              disabled={stageMoveBusy}
              variant="outline"
              className="gap-2"
            >
              {stageMoveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Reopen
            </Button>
          )}
          <Button variant="outline" onClick={openChangeLorry} className="gap-2">
            <Truck className="w-4 h-4" /> Change Lorry
          </Button>
          <Button variant="outline" onClick={handleEditClick}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
          <Button variant="default" onClick={handlePrint} disabled={printing}>
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Print
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent Value (Original)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {totalSentValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Final Value (Reconciled)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">Rs. {totalFinalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className={totalDiff !== 0 ? totalDiff > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalDiff > 0 ? "text-green-700" : totalDiff < 0 ? "text-red-700" : ""}`}>
              {totalDiff > 0 ? "+" : ""}{totalDiff !== 0 ? "Rs. " + totalDiff.toLocaleString() : "-"}
            </div>
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
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-medium">{loadingSheet.lorryNumber}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Driver</span>
              <span className="font-medium">{loadingSheet.driverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Helper</span>
              <span className="font-medium">{loadingSheet.helperName || "-"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 items-center justify-center h-full py-2">
              <Badge className={`text-lg px-4 py-1 ${loadingSheet.status === "Completed" ? "bg-green-600" : "bg-blue-600"}`}>
                {loadingSheet.status}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {loadingSheet.status === "Completed" ? "All items reconciled and closed." : "Currently in transit."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Order Details ({loadingSheet.orders.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={openAddDialog} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Orders
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">Sent Amount</TableHead>
                  <TableHead className="text-right">Final Amount</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSheet.orders.map((order) => {
                  const original = order.originalAmount ?? order.totalAmount ?? 0;
                  const final = order.totalAmount ?? 0;
                  const diff = final - original;

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium font-mono">
                        {order.orderId}
                        <div className="text-xs text-muted-foreground">{order.invoiceNo}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.customer.shopName}</div>
                        <div className="text-xs text-muted-foreground">{order.customer.address}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">{original.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold font-mono">{final.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${diff !== 0 ? diff > 0 ? "text-green-600" : "text-red-600" : "text-muted-foreground"}`}>
                        {diff > 0 ? "+" : ""}{diff !== 0 ? diff.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => { setRemoveTarget({ id: order.id, shopName: order.customer.shopName, invoiceNo: order.invoiceNo }); setRemoveStage("Loading"); }}
                          disabled={removingOrderId === order.id}
                        >
                          {removingOrderId === order.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <X className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Remove Order — Stage Picker Dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-500" />
              Remove from Loading Sheet
            </DialogTitle>
            <DialogDescription>
              Select the stage to send <strong>{removeTarget?.invoiceNo || removeTarget?.shopName}</strong> back to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={removeStage} onValueChange={setRemoveStage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Checking">Checking</SelectItem>
                <SelectItem value="Loading">Loading</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              onClick={confirmRemoveOrder}
              disabled={!!removingOrderId}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {removingOrderId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Move to {removeStage}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Orders Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-indigo-600" />
              Add Orders to Sheet
            </DialogTitle>
            <DialogDescription>
              Select orders from the loading queue to add to this sheet.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search shop, invoice..."
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            className="mb-2"
          />

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {loadingAvailable ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredAvailable.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No orders available in the loading queue.</p>
            ) : (
              filteredAvailable.map((o) => {
                const checked = selectedAddIds.includes(o.id);
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedAddIds((prev) => prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id])}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${checked ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"}`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => {}} onClick={(e) => e.stopPropagation()} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.shopName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{o.invoiceNo || o.orderId}</p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">LKR {o.totalAmount.toLocaleString()}</span>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddOrders}
              disabled={addingBusy || selectedAddIds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addingBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add {selectedAddIds.length > 0 ? `(${selectedAddIds.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Lorry Dialog */}
      <Dialog open={changeLorryOpen} onOpenChange={setChangeLorryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-teal-600" />
              Change Lorry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto py-2">
            {lorries.map((lorry) => {
              const isSelected = newLorry === lorry.name;
              return (
                <button
                  key={lorry.id}
                  onClick={() => setNewLorry(lorry.name)}
                  className={`w-full text-left rounded-xl border p-3 transition-all flex items-center gap-2 ${isSelected ? "border-teal-500 bg-teal-50 ring-1 ring-teal-400" : "border-slate-200 hover:border-teal-300 hover:bg-teal-50/30"}`}
                >
                  <Truck className={`h-4 w-4 shrink-0 ${isSelected ? "text-teal-600" : "text-slate-400"}`} />
                  <span className={`font-semibold text-sm ${isSelected ? "text-teal-700" : "text-slate-700"}`}>{lorry.name}</span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeLorryOpen(false)}>Cancel</Button>
            <Button
              onClick={handleChangeLorry}
              disabled={changeLorryBusy || !newLorry || newLorry === loadingSheet.lorryNumber}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {changeLorryBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loading Sheet</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Lorry</Label>
              <Select value={editForm.lorryNumber} onValueChange={(val) => setEditForm({ ...editForm, lorryNumber: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lorries.map((l) => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Driver</Label>
              <Select value={editForm.driverId} onValueChange={(val) => setEditForm({ ...editForm, driverId: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.filter((u) => u.role === "driver" || u.role === "delivery").map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Helper</Label>
              <Input value={editForm.helperName} onChange={(e) => setEditForm({ ...editForm, helperName: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Transit">In Transit</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateLoadingSheet} disabled={updating}>
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
