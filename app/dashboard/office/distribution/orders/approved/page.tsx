"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  Search,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";

interface LorryOrder {
  id: string;
  orderId: string;
  invoiceNo: string;
  shopName: string;
  totalAmount: number;
  status?: string;
}

interface LorryGroup {
  id: string;
  loadId: string;
  lorryNumber: string;
  orders: LorryOrder[];
  totalAmount: number;
}

interface ApprovedOrder {
  id: string;
  orderId: string;
  invoiceNo: string;
  shopName: string;
  customerName: string;
  salesRep: string;
  totalAmount: number;
  date: string;
}

export default function DistributionApprovedOrdersPage() {
  const [groups, setGroups] = useState<LorryGroup[]>([]);
  const [orders, setOrders] = useState<ApprovedOrder[]>([]);
  const [lorries, setLorries] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOrderIds, setAssignOrderIds] = useState<string[]>([]);
  const [pickedLorry, setPickedLorry] = useState<string>("");
  const [assignBusy, setAssignBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, groupsRes, lorryRes] = await Promise.all([
        fetch("/api/orders?status=Approved"),
        fetch("/api/loading-groups"),
        fetch("/api/settings/categories?type=lorry"),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (lorryRes.ok) setLorries(await lorryRes.json());
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const assignedOrderIds = useMemo(
    () => new Set(groups.flatMap((g) => g.orders.map((o) => o.id))),
    [groups]
  );

  const groupByLorry = useMemo(() => {
    const m: Record<string, LorryGroup> = {};
    for (const g of groups) m[g.lorryNumber] = g;
    return m;
  }, [groups]);

  const unassignedOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          !assignedOrderIds.has(o.id) &&
          (search === "" ||
            o.shopName.toLowerCase().includes(search.toLowerCase()) ||
            o.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
            o.customerName.toLowerCase().includes(search.toLowerCase()))
      ),
    [orders, assignedOrderIds, search]
  );

  const totalAssigned = assignedOrderIds.size;
  const totalUnassigned = orders.length - totalAssigned;

  const toggleExpand = (lorryName: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(lorryName) ? next.delete(lorryName) : next.add(lorryName);
      return next;
    });

  const toggleSelect = (id: string) =>
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAll = () =>
    setSelectedOrderIds(
      selectedOrderIds.length === unassignedOrders.length
        ? []
        : unassignedOrders.map((o) => o.id)
    );

  const openAssign = (orderIds: string[]) => {
    setAssignOrderIds(orderIds);
    setPickedLorry("");
    setAssignOpen(true);
  };

  const handleConfirmAssign = async () => {
    if (!pickedLorry) { toast.error("Please select a lorry."); return; }
    setAssignBusy(true);
    try {
      const existingGroup = groupByLorry[pickedLorry];
      if (existingGroup) {
        const res = await fetch(`/api/loading-groups/${existingGroup.id}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: assignOrderIds }),
        });
        if (!res.ok) throw new Error("Failed to assign orders");
      } else {
        const res = await fetch("/api/loading-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lorryNumber: pickedLorry,
            driverId: "",
            helperName: "",
            orderIds: assignOrderIds,
          }),
        });
        if (!res.ok) throw new Error("Failed to create lorry group");
      }

      await Promise.all(
        assignOrderIds.map((id) =>
          fetch(`/api/orders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Processing" }),
          })
        )
      );

      toast.success(`${assignOrderIds.length} order(s) assigned to ${pickedLorry} and moved to Processing.`);
      setSelectedOrderIds([]);
      setAssignOpen(false);
      await fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAssignBusy(false);
    }
  };

  const handleRemoveOrder = async (groupId: string, order: LorryOrder) => {
    if (order.status === "Checking" || order.status === "Loading" || order.status === "Dispatched" || order.status === "Delivered") {
      toast.error(`Cannot remove order while it is ${order.status}. This can only be changed in the Loading section.`);
      return;
    }

    try {
      const res = await fetch(`/api/loading-groups/${groupId}/orders/${order.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");

      // Revert order status back to Approved
      const patchRes = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });
      if (!patchRes.ok) throw new Error("Failed to update order status");

      toast.success("Order removed from lorry and reverted to Approved.");
      await fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approved Orders</h1>
        <p className="text-sm text-muted-foreground">
          Assign approved orders to lorries, then move them to Processing.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2">
            <Boxes className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Approved</p>
            <p className="text-xl font-bold">{orders.length}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="rounded-lg bg-teal-50 p-2">
            <Truck className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assigned</p>
            <p className="text-xl font-bold text-teal-700">{totalAssigned}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="rounded-lg bg-amber-50 p-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unassigned</p>
            <p className="text-xl font-bold text-amber-600">{totalUnassigned}</p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* LEFT: Unassigned Orders */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
            <CardHeader className="px-0 sm:px-6 pb-2 pt-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Approved Orders ({unassignedOrders.length})
                </h2>
                {selectedOrderIds.length > 0 && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white animate-in fade-in zoom-in duration-200"
                    onClick={() => openAssign(selectedOrderIds)}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    Assign Selected ({selectedOrderIds.length})
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoice, shop..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white border-slate-200"
                />
              </div>
            </CardHeader>

            <CardContent className="px-0 sm:px-6 pt-0">
              {unassignedOrders.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-slate-50">
                  {orders.length === 0 ? (
                    <>
                      <AlertCircle className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-medium">No approved orders yet</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-10 w-10 text-teal-400 opacity-40" />
                      <p className="text-sm">All approved orders have been assigned to lorries</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block rounded-md border bg-white overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={unassignedOrders.length > 0 && selectedOrderIds.length === unassignedOrders.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wide">Invoice</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wide">Shop</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">Rep</TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="w-20" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unassignedOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                              selectedOrderIds.includes(order.id) ? "bg-indigo-50/40" : ""
                            }`}
                            onClick={() => toggleSelect(order.id)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedOrderIds.includes(order.id)}
                                onCheckedChange={() => toggleSelect(order.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-semibold text-indigo-700 flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {order.invoiceNo}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium leading-tight truncate max-w-[140px] text-slate-900">{order.shopName}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[140px]">{order.customerName}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
                                  {order.salesRep?.charAt(0).toUpperCase()}
                                </div>
                                {order.salesRep}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">LKR {order.totalAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAssign([order.id]);
                                }}
                              >
                                <Truck className="h-3 w-3" /> Assign
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {unassignedOrders.map((order) => (
                      <div
                        key={order.id}
                        className={`bg-white border rounded-xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform ${
                          selectedOrderIds.includes(order.id) ? "border-indigo-400 bg-indigo-50/20" : "border-slate-200"
                        }`}
                        onClick={() => toggleSelect(order.id)}
                      >
                        <Checkbox
                          checked={selectedOrderIds.includes(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 font-mono text-xs font-bold text-indigo-700 bg-indigo-50 w-fit px-1.5 py-0.5 rounded">
                            <FileText className="h-3 w-3" />
                            {order.invoiceNo}
                          </div>
                          <p className="text-sm font-medium truncate mt-1">{order.shopName}</p>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {order.salesRep}
                            </div>
                            <span className="text-xs font-bold text-slate-900">LKR {order.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs px-2 shrink-0 border-indigo-200 text-indigo-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssign([order.id]);
                          }}
                        >
                          <Truck className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: All Lorries */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
            <CardHeader className="px-0 sm:px-4 pb-2 pt-4">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Lorries ({lorries.length})
              </h2>
            </CardHeader>
            <CardContent className="px-0 sm:px-4 pt-0 space-y-3">
              {lorries.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-slate-50">
                  <Truck className="h-10 w-10 opacity-20" />
                  <p className="text-sm">No lorries configured</p>
                </div>
              ) : (
                lorries.map((lorry) => {
                  const group = groupByLorry[lorry.name];
                  const expanded = expandedGroups.has(lorry.name);
                  const orderCount = group?.orders.length ?? 0;
                  const hasOrders = orderCount > 0;

                  return (
                    <div key={lorry.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                      <div className={`px-4 py-3 flex items-center justify-between gap-2 ${hasOrders ? "bg-linear-to-r from-teal-600 to-teal-500 text-white" : "bg-slate-50 text-slate-700"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Truck className={`h-4 w-4 shrink-0 ${hasOrders ? "text-white" : "text-slate-400"}`} />
                          <span className="font-bold text-sm truncate">{lorry.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {group && (
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${hasOrders ? "bg-white/20" : "bg-slate-200 text-slate-500"}`}>
                              {group.loadId}
                            </span>
                          )}
                          <Badge className={`text-xs shrink-0 border ${hasOrders ? "bg-white/20 text-white border-white/30" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                            {orderCount} orders
                          </Badge>
                        </div>
                      </div>

                      {hasOrders && group && (
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">
                              LKR {group.totalAmount.toLocaleString()}
                            </span>
                            <button
                              onClick={() => toggleExpand(lorry.name)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {expanded ? "Hide" : "Show"}
                            </button>
                          </div>

                          {expanded && (
                            <div className="space-y-1.5 pt-1 border-t">
                              {group.orders.map((o) => (
                                <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="font-mono text-xs font-semibold truncate text-teal-700">{o.invoiceNo}</p>
                                      <p className="text-xs text-muted-foreground truncate">{o.shopName}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs font-medium">{o.totalAmount.toLocaleString()}</span>
                                    <button
                                      onClick={() => handleRemoveOrder(group.id, o)}
                                      className="text-red-400 hover:text-red-600 transition-colors"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!hasOrders && (
                        <div className="px-4 py-2">
                          <p className="text-xs text-muted-foreground">No orders assigned</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Assign Lorry Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-teal-600" />
              Select Lorry
            </DialogTitle>
            <DialogDescription>
              {assignOrderIds.length} order{assignOrderIds.length !== 1 ? "s" : ""} will be assigned to the selected lorry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {lorries.map((lorry) => {
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
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirmAssign}
              disabled={assignBusy || !pickedLorry}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {assignBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Lorry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
