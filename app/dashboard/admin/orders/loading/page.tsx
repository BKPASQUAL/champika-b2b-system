// app/dashboard/admin/orders/loading/page.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  Truck,
  History,
  PlusCircle,
  Loader2,
  RefreshCw,
  FileText,
  User,
  MapPin,
  Download,
  Printer,
  FolderOpen,
  Folder,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSheetDialog } from "@/app/dashboard/admin/orders/_components/LoadingSheetDialog";
import { downloadLoadingSummary, printLoadingSummary } from "./print-loading-summary";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface Order {
  id: string;
  orderId: string;
  invoiceId?: string;
  invoiceNo?: string;
  shopName: string;
  route: string;
  salesRepName: string;
  totalAmount: number;
  status: string;
  date?: string;
}

interface LorryGroup {
  id: string;
  loadId: string;
  lorryNumber: string;
  driverName: string;
  orders: { id: string }[];
}

export default function LoadingOrdersPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [lorryFilter, setLorryFilter] = useState<string>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("loading_lorryFilter") ?? "all"
      : "all"
  );
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [addToExistingOpen, setAddToExistingOpen] = useState(false);
  const [existingSheets, setExistingSheets] = useState<{ id: string; loadId: string; lorryNumber: string; totalOrders: number }[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [addingToExistingBusy, setAddingToExistingBusy] = useState(false);

  const {
    data: orders = [],
    loading: ordersLoading,
    refetch: fetchOrders,
  } = useCachedFetch<Order[]>("/api/orders/loading", [], () =>
    toast.error("Failed to load orders")
  );

  const {
    data: groups = [],
    loading: groupsLoading,
    refetch: fetchGroups,
  } = useCachedFetch<LorryGroup[]>("/api/loading-groups", [], () =>
    toast.error("Failed to load lorry groups")
  );

  const loading = ordersLoading || groupsLoading;

  const refetchAll = useCallback(() => {
    fetchOrders();
    fetchGroups();
  }, [fetchOrders, fetchGroups]);

  const lorryMap = useMemo(() => {
    const m: Record<string, LorryGroup> = {};
    for (const g of groups) for (const o of g.orders) m[o.id] = g;
    return m;
  }, [groups]);

  const groupKeys = useMemo(() => {
    const seen = new Map<string, LorryGroup>();
    for (const o of orders) {
      const g = lorryMap[o.id];
      if (g) {
        const key = g.lorryNumber || g.loadId;
        if (!seen.has(key)) seen.set(key, g);
      }
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders, lorryMap]);

  const preselectedLorry = useMemo(() => {
    const nums = new Set(selectedOrders.map((id) => lorryMap[id]?.lorryNumber).filter(Boolean));
    return nums.size === 1 ? [...nums][0] : "";
  }, [selectedOrders, lorryMap]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orders.filter((order) => {
      if (lorryFilter !== "all") {
        const g = lorryMap[order.id];
        const key = g ? g.lorryNumber || g.loadId : null;
        if (key !== lorryFilter) return false;
      }
      return (
        !q ||
        (order.invoiceNo && order.invoiceNo.toLowerCase().includes(q)) ||
        order.orderId.toLowerCase().includes(q) ||
        order.shopName.toLowerCase().includes(q) ||
        (order.salesRepName && order.salesRepName.toLowerCase().includes(q))
      );
    });
  }, [orders, searchQuery, lorryFilter, lorryMap]);

  const setFilter = (val: string) => {
    setLorryFilter(val);
    sessionStorage.setItem("loading_lorryFilter", val);
  };

  const toggleSelectOrder = (id: string) =>
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAll = () =>
    setSelectedOrders(
      selectedOrders.length === filteredOrders.length
        ? []
        : filteredOrders.map((o) => o.id)
    );

  const openAddToExisting = async () => {
    setSelectedSheetId("");
    setAddToExistingOpen(true);
    setLoadingSheets(true);
    try {
      const res = await fetch("/api/orders/loading/history");
      if (res.ok) {
        const data = await res.json();
        setExistingSheets(data.filter((s: any) => s.status === "In Transit"));
      }
    } catch {
      toast.error("Failed to load existing sheets");
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleAddToExisting = async () => {
    if (!selectedSheetId) return;
    setAddingToExistingBusy(true);
    try {
      const user = getUserBusinessContext();
      const res = await fetch(`/api/orders/loading/history/${selectedSheetId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrders, userId: user?.id }),
      });
      if (!res.ok) throw new Error("Failed to add orders");
      toast.success(`${selectedOrders.length} order(s) added to loading sheet.`);
      setAddToExistingOpen(false);
      setSelectedOrders([]);
      refetchAll();
      router.push(`/dashboard/admin/orders/loading/history/${selectedSheetId}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingToExistingBusy(false);
    }
  };

  const handleCreateLoad = async (formData: any) => {
    try {
      const user = getUserBusinessContext();
      const res = await fetch("/api/orders/loading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lorryNumber: formData.lorryNumber,
          driverId: formData.driverId,
          helperName: formData.helperName || "",
          date: formData.date,
          orderIds: selectedOrders,
          userId: user?.id,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create load");
      toast.success(`Load Sheet ${result.loadId} Created!`);
      refetchAll();
      router.push("/dashboard/admin/orders/loading/history");
    } catch (error: any) {
      toast.error(error.message);
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loading Orders</h1>
          <p className="text-muted-foreground text-sm">
            Select orders to create a delivery load.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={refetchAll}
            title="Refresh"
            className="bg-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/admin/orders/loading/history")}
            className="bg-white"
          >
            <History className="w-4 h-4 mr-2" /> History
          </Button>
          {selectedOrders.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => printLoadingSummary(selectedOrders)}
                className="animate-in fade-in zoom-in duration-300 bg-white border-slate-200"
              >
                <Printer className="w-4 h-4 mr-2" /> Print Summary ({selectedOrders.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadLoadingSummary(selectedOrders)}
                className="animate-in fade-in zoom-in duration-300 bg-white border-slate-200"
              >
                <Download className="w-4 h-4 mr-2" /> Download Summary ({selectedOrders.length})
              </Button>
              <Button
                variant="outline"
                onClick={openAddToExisting}
                className="animate-in fade-in zoom-in duration-300 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
              >
                <FolderOpen className="w-4 h-4 mr-2" /> Add to Existing Sheet ({selectedOrders.length})
              </Button>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="animate-in fade-in zoom-in duration-300 bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Truck className="w-4 h-4 mr-2" /> Create Load Sheet ({selectedOrders.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-4 space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Invoice No, Order ID, Shop Name, or Rep..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="shrink-0 bg-white"
            >
              {selectedOrders.length === filteredOrders.length && filteredOrders.length > 0
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>

          {/* Lorry / Folder filter pills */}
          {groupKeys.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  lorryFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-muted-foreground border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                All
              </button>
              {groupKeys.map(([key, g]) => (
                <button
                  key={key}
                  onClick={() => setFilter(lorryFilter === key ? "all" : key)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    lorryFilter === key
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                  }`}
                >
                  {g.lorryNumber ? <Truck className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Orders Cards for Mobile */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-white rounded-lg border">
              No orders ready for loading.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSelected = selectedOrders.includes(order.id);
              const lorryGroup = lorryMap[order.id];

              return (
                <Card
                  key={order.id}
                  className={`cursor-pointer transition-all border ${
                    isSelected ? "border-teal-500 bg-teal-50/20 shadow-sm" : "bg-white"
                  }`}
                  onClick={() => toggleSelectOrder(order.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/admin/orders/${order.id}`);
                          }}
                          className="flex items-center gap-1 font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs transition-colors hover:bg-indigo-100 hover:text-indigo-900 cursor-pointer"
                          title="Click to view order"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{order.invoiceNo || order.orderId}</span>
                        </div>
                      </div>
                      {lorryGroup && (
                        <div className="flex items-center gap-1 shrink-0">
                          {lorryGroup.lorryNumber ? (
                            <Truck className="h-3 w-3 text-teal-600" />
                          ) : (
                            <Folder className="h-3 w-3 text-indigo-600" />
                          )}
                          <span className={`text-xs font-medium ${lorryGroup.lorryNumber ? "text-teal-700" : "text-indigo-700"}`}>
                            {lorryGroup.lorryNumber || lorryGroup.loadId}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-sm">{order.shopName}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {order.route}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {order.salesRepName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <span className="font-bold text-slate-800">
                        LKR {order.totalAmount.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50">
                          {order.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-slate-50 px-2"
                          onClick={() => router.push(`/dashboard/admin/orders/${order.id}`)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Order
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Orders Table for Desktop */}
        <div className="hidden md:block rounded-md border bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedOrders.length === filteredOrders.length &&
                      filteredOrders.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead>Customer / Shop</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Lorry / Folder</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead className="text-right">Total Bill</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No orders ready for loading.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = selectedOrders.includes(order.id);
                  const lorryGroup = lorryMap[order.id];

                  return (
                    <TableRow
                      key={order.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-teal-50/40 hover:bg-teal-50/60" : "hover:bg-slate-50"
                      }`}
                      onClick={() => toggleSelectOrder(order.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                        />
                      </TableCell>
                      <TableCell
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/admin/orders/${order.id}`);
                        }}
                      >
                        <div className="flex flex-col">
                          <span
                            className="font-mono font-bold text-xs text-indigo-700 hover:text-indigo-900 transition-colors flex items-center gap-1"
                            title="Click to view order"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {order.invoiceNo || "No Inv No"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {order.orderId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {order.shopName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {order.route}
                      </TableCell>
                      <TableCell>
                        {lorryGroup ? (
                          <div className="flex items-center gap-1.5">
                            {lorryGroup.lorryNumber ? (
                              <Truck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                            ) : (
                              <Folder className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            )}
                            <span className={`text-xs font-semibold ${lorryGroup.lorryNumber ? "text-teal-700" : "text-indigo-700"}`}>
                              {lorryGroup.lorryNumber || lorryGroup.loadId}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {order.salesRepName}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800">
                        LKR {order.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-teal-700 border-teal-200 bg-teal-50"
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs hover:bg-slate-100 hover:text-slate-900 border-slate-200"
                          onClick={() => router.push(`/dashboard/admin/orders/${order.id}`)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Order
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal Dialog for Loading Sheet Creation */}
      <LoadingSheetDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedOrdersCount={selectedOrders.length}
        preselectedLorryNumber={preselectedLorry}
        onSubmit={handleCreateLoad}
      />

      {/* Modal Dialog for Adding to Existing Loading Sheet */}
      <Dialog open={addToExistingOpen} onOpenChange={setAddToExistingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <FolderOpen className="h-5 w-5" />
              Add Orders to Existing Sheet
            </DialogTitle>
            <DialogDescription>
              Select an in-transit loading sheet to add the {selectedOrders.length} selected order(s) to.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {loadingSheets ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : existingSheets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active in-transit loading sheets found.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {existingSheets.map((sheet) => (
                  <label
                    key={sheet.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSheetId === sheet.id
                        ? "border-indigo-500 bg-indigo-50/60"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="existingSheet"
                        value={sheet.id}
                        checked={selectedSheetId === sheet.id}
                        onChange={() => setSelectedSheetId(sheet.id)}
                        className="text-indigo-600"
                      />
                      <div>
                        <p className="font-semibold text-sm text-slate-800 font-mono">
                          {sheet.loadId}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {sheet.lorryNumber}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {sheet.totalOrders} order(s)
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddToExistingOpen(false)}
              disabled={addingToExistingBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToExisting}
              disabled={!selectedSheetId || addingToExistingBusy}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addingToExistingBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...
                </>
              ) : (
                "Add Orders"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
