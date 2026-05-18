"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Package,
  User,
  Calendar,
  FileText,
  Lock,
  Truck,
  Download,
  Printer,
  RefreshCw,
  PackageCheck,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Order, OrderStatus } from "../types";
import { downloadLoadingSummary } from "../loading/print-loading-summary";
import { printBulkInvoices } from "@/app/lib/invoice-print";

interface LorryGroup {
  id: string;
  loadId: string;
  lorryNumber: string;
  driverId: string;
  driverName: string;
  helperName: string;
  orders: { id: string }[];
  totalAmount: number;
}

const LOCK_EXPIRE_MS = 30 * 60 * 1000;

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "Approved", label: "Approved" },
  { value: "Pending", label: "Pending" },
];

export default function DistributionProcessingOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [groups, setGroups] = useState<LorryGroup[]>([]);
  const [lorries, setLorries] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [lorryFilter, setLorryFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("processing_lorryFilter") ?? "all";
    }
    return "all";
  });

  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>("Approved");
  const [changingStatus, setChangingStatus] = useState(false);

  const [assignLorryOpen, setAssignLorryOpen] = useState(false);
  const [pickedLorry, setPickedLorry] = useState("");
  const [assigningLorry, setAssigningLorry] = useState(false);

  const [moveAllCheckingOpen, setMoveAllCheckingOpen] = useState(false);
  const [movingAllChecking, setMovingAllChecking] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, groupsRes, lorryRes] = await Promise.all([
        fetch("/api/orders?status=Processing"),
        fetch("/api/loading-groups"),
        fetch("/api/settings/categories?type=lorry"),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (lorryRes.ok) setLorries(await lorryRes.json());
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isOrderLocked = (order: Order) =>
    !!order.lockedBy && !!order.lockedAt &&
    Date.now() - new Date(order.lockedAt).getTime() < LOCK_EXPIRE_MS;

  const lorryMap = useMemo(() => {
    const m: Record<string, LorryGroup> = {};
    for (const g of groups) for (const o of g.orders) m[o.id] = g;
    return m;
  }, [groups]);

  const groupByLorry = useMemo(() => {
    const m: Record<string, LorryGroup> = {};
    for (const g of groups) m[g.lorryNumber] = g;
    return m;
  }, [groups]);

  const lorryNumbers = useMemo(() => {
    const seen = new Set<string>();
    for (const o of orders) {
      const ln = lorryMap[o.id]?.lorryNumber;
      if (ln) seen.add(ln);
    }
    return [...seen].sort();
  }, [orders, lorryMap]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orders.filter((order) => {
      if (lorryFilter !== "all" && lorryMap[order.id]?.lorryNumber !== lorryFilter) return false;
      return (
        !q ||
        (order.invoiceNo && order.invoiceNo.toLowerCase().includes(q)) ||
        order.orderId.toLowerCase().includes(q) ||
        order.shopName.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q)
      );
    });
  }, [orders, searchQuery, lorryFilter, lorryMap]);

  const toggleSelect = (id: string) =>
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAll = () =>
    setSelectedOrders(
      selectedOrders.length === filteredOrders.length
        ? []
        : filteredOrders.map((o) => o.id)
    );

  const handleBulkStatusChange = async () => {
    setChangingStatus(true);
    let successCount = 0;
    let failCount = 0;
    await Promise.all(
      selectedOrders.map(async (id) => {
        try {
          const res = await fetch(`/api/orders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: targetStatus }),
          });
          if (res.ok) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      })
    );
    setChangingStatus(false);
    setStatusDialogOpen(false);
    setSelectedOrders([]);
    if (successCount > 0) toast.success(`${successCount} order${successCount !== 1 ? "s" : ""} moved to ${targetStatus}`);
    if (failCount > 0) toast.error(`${failCount} order${failCount !== 1 ? "s" : ""} failed to update`);
    fetchData();
  };

  const handleMoveAllToChecking = async () => {
    setMovingAllChecking(true);
    let successCount = 0;
    let failCount = 0;
    await Promise.all(
      selectedOrders.map(async (id) => {
        try {
          const res = await fetch(`/api/orders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Checking" }),
          });
          if (res.ok) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      })
    );
    setMovingAllChecking(false);

    setMoveAllCheckingOpen(false);
    setSelectedOrders([]);
    if (successCount > 0) toast.success(`${successCount} order${successCount !== 1 ? "s" : ""} moved to Checking`);
    if (failCount > 0) toast.error(`${failCount} order${failCount !== 1 ? "s" : ""} failed to update`);
    fetchData();
  };


  const handleConfirmAssignLorry = async () => {
    if (!pickedLorry) { toast.error("Please select a lorry."); return; }
    setAssigningLorry(true);
    try {
      const existingGroup = groupByLorry[pickedLorry];
      if (existingGroup) {
        const res = await fetch(`/api/loading-groups/${existingGroup.id}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: selectedOrders }),
        });
        if (!res.ok) throw new Error("Failed to assign orders to lorry");
      } else {
        const res = await fetch("/api/loading-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lorryNumber: pickedLorry,
            driverId: "",
            helperName: "",
            orderIds: selectedOrders,
          }),
        });
        if (!res.ok) throw new Error("Failed to create lorry group");
      }
      toast.success(`${selectedOrders.length} order${selectedOrders.length !== 1 ? "s" : ""} assigned to ${pickedLorry}`);
      setAssignLorryOpen(false);
      setSelectedOrders([]);
      setPickedLorry("");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAssigningLorry(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="">
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Processing Orders</h1>
          <p className="text-muted-foreground text-sm">
            Orders currently being picked and packed.
          </p>
        </div>

        {selectedOrders.length > 0 && (
          <div className="flex flex-wrap gap-2 animate-in fade-in zoom-in duration-300">
            <Button
              variant="outline"
              onClick={() => {
                const invoiceIds = filteredOrders
                  .filter((o) => selectedOrders.includes(o.id) && o.invoiceId)
                  .map((o) => o.invoiceId as string);
                if (invoiceIds.length === 0) {
                  toast.error("No invoices found for the selected orders.");
                  return;
                }
                printBulkInvoices(invoiceIds, "distribution");
              }}
              className="bg-white border-slate-200"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Invoices ({selectedOrders.length})
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadLoadingSummary(selectedOrders, {
                  title: "PROCESSING ORDERS — ITEMS SUMMARY REPORT",
                  filePrefix: "Processing_Summary",
                })
              }
              className="bg-white border-slate-200"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Summary ({selectedOrders.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => { setPickedLorry(""); setAssignLorryOpen(true); }}
              className="bg-white border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              <Truck className="w-4 h-4 mr-2" />
              Assign Lorry ({selectedOrders.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(true)}
              className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Change Status ({selectedOrders.length})
            </Button>
            <Button
              onClick={() => setMoveAllCheckingOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Move to Checking ({selectedOrders.length})
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Card */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-2 pt-2 space-y-2">
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

          {lorryNumbers.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => { setLorryFilter("all"); sessionStorage.setItem("processing_lorryFilter", "all"); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  lorryFilter === "all"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                All
              </button>
              {lorryNumbers.map((ln) => (
                <button
                  key={ln}
                  onClick={() => {
                    const next = lorryFilter === ln ? "all" : ln;
                    setLorryFilter(next);
                    sessionStorage.setItem("processing_lorryFilter", next);
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    lorryFilter === ln
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                  }`}
                >
                  <Truck className="h-3 w-3" />
                  {ln}
                </button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="px-0 sm:px-6 pt-0">
          {/* --- MOBILE VIEW --- */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <div className="flex flex-col items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p>No orders in processing.</p>
                </div>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const lorryGroup = lorryMap[order.id];
                const locked = isOrderLocked(order);
                const isSelected = selectedOrders.includes(order.id);
                return (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-200 ${
                      isSelected
                        ? "border-blue-400 ring-1 ring-blue-400 bg-blue-50/10"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(order.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                              <FileText className="h-3 w-3" />
                              {order.invoiceNo || "N/A"}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">({order.orderId})</span>
                          </div>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                            Processing
                          </Badge>
                        </div>

                        <div
                          className="flex justify-between items-start gap-2 cursor-pointer"
                          onClick={() => {
                            if (locked) { toast.info(`In use by ${order.lockedBy}`); return; }
                            router.push(`/dashboard/office/distribution/orders/processing/${order.id}`);
                          }}
                        >
                          <div className="flex flex-col min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{order.shopName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(order.date).toLocaleDateString()}
                            </div>
                            {lorryGroup && (
                              <div className="flex items-center gap-1 mt-1">
                                <Truck className="h-3 w-3 text-teal-600" />
                                <span className="text-xs font-medium text-teal-700">{lorryGroup.lorryNumber}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                            <User className="h-3 w-3" />
                            <span>{order.salesRep}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2 mt-1">
                          <div>
                            <p className="text-xs text-muted-foreground">Items</p>
                            <p className="font-medium">{order.itemCount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Total Amount</p>
                            <p className="font-bold text-slate-900">LKR {order.totalAmount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {locked ? (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg h-9 w-full">
                        <Lock className="h-3.5 w-3.5" />
                        <span>In Use by {order.lockedBy}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white h-9"
                        disabled={selectedOrders.length > 0 && !isSelected}
                        onClick={() => router.push(`/dashboard/office/distribution/orders/processing/${order.id}`)}
                      >
                        Pack Order <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* --- DESKTOP VIEW --- */}
          <div className="hidden md:block rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
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
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Lorry</TableHead>
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
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p>No processing orders found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const lorryGroup = lorryMap[order.id];
                    const locked = isOrderLocked(order);
                    const isSelected = selectedOrders.includes(order.id);
                    return (
                      <TableRow
                        key={order.id}
                        className={`hover:bg-slate-50 ${isSelected ? "bg-blue-50/30" : ""}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {new Date(order.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium font-mono text-blue-700 text-xs flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {order.invoiceNo || "N/A"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">{order.orderId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-slate-900">{order.shopName}</span>
                            <span className="text-xs text-muted-foreground">{order.customerName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lorryGroup ? (
                            <div className="flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                              <span className="text-xs font-semibold text-teal-700">{lorryGroup.lorryNumber}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{order.salesRep}</TableCell>
                        <TableCell className="text-right text-sm">{order.itemCount}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          LKR {order.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Processing
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {locked ? (
                            <div className="flex items-center justify-end gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded h-8">
                              <Lock className="h-3 w-3" />
                              <span>{order.lockedBy}</span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                              disabled={selectedOrders.length > 0 && !isSelected}
                              onClick={() => router.push(`/dashboard/office/distribution/orders/processing/${order.id}`)}
                            >
                              Pack <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assign Lorry Dialog */}
      <Dialog open={assignLorryOpen} onOpenChange={setAssignLorryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-teal-600" />
              Assign Lorry
            </DialogTitle>
            <DialogDescription>
              {selectedOrders.length} order{selectedOrders.length !== 1 ? "s" : ""} will be moved to the selected lorry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {lorries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No lorries configured.</p>
            ) : (
              lorries.map((lorry) => {
                const group = groupByLorry[lorry.name];
                const isSelected = pickedLorry === lorry.name;
                return (
                  <button
                    key={lorry.id}
                    onClick={() => setPickedLorry(lorry.name)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      isSelected
                        ? "border-teal-500 bg-teal-50 ring-1 ring-teal-400"
                        : "border-slate-200 hover:border-teal-300 hover:bg-teal-50/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Truck className={`h-4 w-4 shrink-0 ${isSelected ? "text-teal-600" : "text-slate-400"}`} />
                        <span className={`font-semibold text-sm ${isSelected ? "text-teal-700" : "text-slate-700"}`}>
                          {lorry.name}
                        </span>
                      </div>
                      {group && group.orders.length > 0 && (
                        <Badge className="bg-teal-50 text-teal-700 border-teal-200 border text-xs">
                          <PackageCheck className="h-3 w-3 mr-1" />
                          {group.orders.length} assigned
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignLorryOpen(false)} disabled={assigningLorry}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAssignLorry}
              disabled={assigningLorry || !pickedLorry}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {assigningLorry ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Assigning...</>
              ) : (
                "Assign Lorry"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move All to Checking Dialog */}
      <Dialog open={moveAllCheckingOpen} onOpenChange={setMoveAllCheckingOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-purple-600" />
              Move All to Checking
            </DialogTitle>
            <DialogDescription>
              This will move {selectedOrders.length} selected order{selectedOrders.length !== 1 ? "s" : ""} to <strong>Checking</strong> status. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveAllCheckingOpen(false)} disabled={movingAllChecking}>
              Cancel
            </Button>
            <Button
              onClick={handleMoveAllToChecking}
              disabled={movingAllChecking}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {movingAllChecking ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Moving...</>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Order Status</DialogTitle>
            <DialogDescription>
              Change the status of {selectedOrders.length} selected order{selectedOrders.length !== 1 ? "s" : ""} to:
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select
              value={targetStatus}
              onValueChange={(v) => setTargetStatus(v as OrderStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={changingStatus}>
              Cancel
            </Button>
            <Button onClick={handleBulkStatusChange} disabled={changingStatus}>
              {changingStatus ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
