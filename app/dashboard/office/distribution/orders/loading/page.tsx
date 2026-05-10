// app/dashboard/office/distribution/orders/loading/page.tsx
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
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSheetDialog } from "@/app/dashboard/admin/orders/_components/LoadingSheetDialog";
import { downloadLoadingSummary } from "./print-loading-summary";

interface Order {
  id: string;
  orderId: string;
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

export default function DistributionLoadingOrdersPage() {
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

  const lorryNumbers = useMemo(() => {
    const seen = new Set<string>();
    for (const o of orders) {
      const ln = lorryMap[o.id]?.lorryNumber;
      if (ln) seen.add(ln);
    }
    return [...seen].sort();
  }, [orders, lorryMap]);

  const preselectedLorry = useMemo(() => {
    const nums = new Set(selectedOrders.map((id) => lorryMap[id]?.lorryNumber).filter(Boolean));
    return nums.size === 1 ? [...nums][0] : "";
  }, [selectedOrders, lorryMap]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orders.filter((order) => {
      if (lorryFilter !== "all" && lorryMap[order.id]?.lorryNumber !== lorryFilter) return false;
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
      const res = await fetch(`/api/orders/loading/history/${selectedSheetId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrders }),
      });
      if (!res.ok) throw new Error("Failed to add orders");
      toast.success(`${selectedOrders.length} order(s) added to loading sheet.`);
      setAddToExistingOpen(false);
      setSelectedOrders([]);
      refetchAll();
      router.push(`/dashboard/office/distribution/orders/loading/history/${selectedSheetId}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingToExistingBusy(false);
    }
  };

  const handleCreateLoad = async (formData: any) => {
    try {
      const res = await fetch("/api/orders/loading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lorryNumber: formData.lorryNumber,
          driverId: formData.driverId,
          helperName: formData.helperName || "",
          date: formData.date,
          orderIds: selectedOrders,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create load");
      toast.success(`Load Sheet ${result.loadId} Created!`);
      refetchAll();
      router.push("/dashboard/office/distribution/orders/loading/history");
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
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <Button variant="outline" size="icon" onClick={refetchAll} className="bg-white">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/office/distribution/orders/loading/history")}
            className="bg-white"
          >
            <History className="w-4 h-4 mr-2" /> History
          </Button>
          {selectedOrders.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => downloadLoadingSummary(selectedOrders)}
                className="animate-in fade-in zoom-in duration-300 bg-white border-slate-200"
              >
                <Download className="w-4 h-4 mr-2" /> Summary ({selectedOrders.length})
              </Button>
              <Button
                variant="outline"
                onClick={openAddToExisting}
                className="animate-in fade-in zoom-in duration-200 bg-white border-slate-200"
              >
                <FolderOpen className="w-4 h-4 mr-2" /> Add to Existing ({selectedOrders.length})
              </Button>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white animate-in fade-in zoom-in duration-200"
              >
                <PlusCircle className="w-4 h-4 mr-2" /> Create Load ({selectedOrders.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardHeader className="px-0 sm:px-6 pb-2 pt-2 space-y-2">
          {/* Search + Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Invoice, Shop, or Sales Rep..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200"
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0 bg-white">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Lorry filter pills */}
          {lorryNumbers.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter("all")}
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
                  onClick={() => setFilter(lorryFilter === ln ? "all" : ln)}
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
                <div className="flex flex-col items-center gap-2">
                  <Truck className="h-10 w-10 text-muted-foreground/20" />
                  <p>No orders ready for loading</p>
                </div>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrders.includes(order.id);
                const lorryGroup = lorryMap[order.id];
                return (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3 active:scale-[0.99] transition-transform ${
                      isSelected ? "border-indigo-400 bg-indigo-50/10" : "border-slate-200"
                    }`}
                    onClick={() => toggleSelectOrder(order.id)}
                  >
                    {/* Row 1: Checkbox + Invoice + Lorry badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectOrder(order.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-1 font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                          <FileText className="h-3 w-3" />
                          {order.invoiceNo || "N/A"}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">({order.orderId})</span>
                      </div>
                      {lorryGroup && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Truck className="h-3 w-3 text-teal-600" />
                          <span className="text-xs font-medium text-teal-700">{lorryGroup.lorryNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Row 2: Shop & Sales Rep */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{order.shopName}</p>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{order.route}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                        <User className="h-3 w-3" />
                        <span>{order.salesRepName}</span>
                      </div>
                    </div>

                    {/* Row 3: Total */}
                    <div className="flex justify-end border-t pt-2">
                      <p className="font-bold text-slate-900">LKR {order.totalAmount.toLocaleString()}</p>
                    </div>
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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Lorry</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead className="text-right">Total Bill</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-12 w-12 text-muted-foreground/30" />
                        <p className="font-medium">No orders ready for loading</p>
                        <p className="text-sm">Orders appear here once they pass quality checks</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const isSelected = selectedOrders.includes(order.id);
                    const lorryGroup = lorryMap[order.id];
                    return (
                      <TableRow
                        key={order.id}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-50/30" : ""
                        }`}
                        onClick={() => toggleSelectOrder(order.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectOrder(order.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium font-mono text-indigo-700 text-xs flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {order.invoiceNo || "N/A"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {order.orderId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm text-slate-900">{order.shopName}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{order.route || "—"}</span>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
                              {order.salesRepName?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-muted-foreground">{order.salesRepName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          LKR {order.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                            {order.status}
                          </Badge>
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

      <LoadingSheetDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedCount={selectedOrders.length}
        onConfirm={handleCreateLoad}
        preselectedLorry={preselectedLorry}
      />

      <Dialog open={addToExistingOpen} onOpenChange={setAddToExistingOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-600" />
              Add to Existing Load
            </DialogTitle>
            <DialogDescription>
              {selectedOrders.length} order(s) will be added to the selected loading sheet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto py-1">
            {loadingSheets ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : existingSheets.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-8">No active loading sheets (In Transit) found.</p>
            ) : (
              existingSheets.map((sheet) => {
                const isSelected = selectedSheetId === sheet.id;
                return (
                  <button
                    key={sheet.id}
                    onClick={() => setSelectedSheetId(sheet.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${isSelected ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Truck className={`h-4 w-4 shrink-0 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                        <div>
                          <p className={`text-sm font-bold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{sheet.lorryNumber}</p>
                          <p className="text-xs text-muted-foreground font-mono">{sheet.loadId}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{sheet.totalOrders} orders</Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToExistingOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddToExisting}
              disabled={addingToExistingBusy || !selectedSheetId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addingToExistingBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to Load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
