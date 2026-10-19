"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Edit3,
  AlertCircle,
  User,
  Lock,
  Plus,
  Receipt,
  Trash2,
  Truck,
  Package,
  TrendingDown,
  ClipboardList,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExpenseFormDialog } from "@/app/dashboard/admin/expenses/_components/ExpenseDialogs";
import { ExpenseFormData } from "@/app/dashboard/admin/expenses/types";
import { cn } from "@/lib/utils";
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface ReconcileReturnItem {
  id: string;
  returnNumber: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  returnType: "Good" | "Damage" | "Exchange";
  actualCondition: "Good" | "Damage" | null;
  price: number;
  totalValue: number;
  createdAt: string;
}

interface OrderItem {
  id: string;
  orderId: string;
  invoiceId: string | null;
  invoiceNo: string;
  customer: string;
  currentAmount: number;
  originalAmount: number;
  status: string;
  paymentStatus: string;
  returns?: ReconcileReturnItem[];
}

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface LoadDetails {
  id: string;
  loadId: string;
  driverName: string;
  lorryNumber: string;
  status: string;
  createdAt: string;
}

export default function AdminReconcileLoadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadDetails, setLoadDetails] = useState<LoadDetails | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [reconcileData, setReconcileData] = useState<
    Record<string, { status: string; notes?: string }>
  >({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Unload state
  const [unloadingId, setUnloadingId] = useState<string | null>(null);
  const [targetStage, setTargetStage] = useState<string>("Loading");
  const [unloadNotes, setUnloadNotes] = useState<string>("");
  const [isUnloading, setIsUnloading] = useState(false);

  // Expense Dialog states
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("currentUser");
      if (u) setCurrentUser(JSON.parse(u));
    } catch {
      // ignore
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/loading/reconcile/${id}`);
      if (!res.ok) throw new Error("Failed to load details");
      const data = await res.json();
      setLoadDetails(data.load);
      setOrders(data.orders || []);
      setExpenses(data.expenses || []);

      const initialReconcile: Record<string, { status: string; notes?: string }> = {};
      (data.orders || []).forEach((o: OrderItem) => {
        initialReconcile[o.id] = {
          status: o.status,
          notes: "",
        };
      });
      setReconcileData(initialReconcile);
    } catch (err: any) {
      toast.error(err.message || "Failed to load reconciliation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleStatusChange = (orderId: string, status: string) => {
    if (loadDetails?.status === "Completed") {
      toast.info("Load is completed and locked for edits.");
      return;
    }
    setReconcileData((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], status },
    }));
  };

  const handleNotesChange = (orderId: string, notes: string) => {
    if (loadDetails?.status === "Completed") return;
    setReconcileData((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], notes },
    }));
  };

  const handleUnloadOrder = async (orderId: string) => {
    if (loadDetails?.status === "Completed") {
      toast.info("Completed loads cannot be modified.");
      return;
    }
    try {
      setIsUnloading(true);
      const res = await fetch(`/api/orders/loading/reconcile/${id}/unload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          targetStage,
          notes: unloadNotes,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to unload order");
      }

      toast.success(`Order unloaded and moved to ${targetStage}`);
      setUnloadingId(null);
      setUnloadNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to unload order");
    } finally {
      setIsUnloading(false);
    }
  };

  const handleToggleReturnType = async (
    returnId: string,
    currentCondition: "Good" | "Damage"
  ) => {
    if (loadDetails?.status === "Completed") {
      toast.info("Load is completed and returns cannot be changed.");
      return;
    }
    const newCondition = currentCondition === "Good" ? "Damage" : "Good";
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_type: newCondition }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Marked item as ${newCondition}`);
      fetchData();
    } catch {
      toast.error("Failed to update return condition");
    }
  };

  const handleEditInvoice = (invoiceId: string | null) => {
    if (loadDetails?.status === "Completed") {
      toast.info("Load is completed. Invoices cannot be edited.");
      return;
    }
    if (!invoiceId) { toast.error("Invoice not found"); return; }
    router.push(
      `/dashboard/admin/invoices/${invoiceId}/edit?returnTo=/dashboard/admin/orders/loading/reconcile/${id}`
    );
  };

  const handleSubmitExpense = async (data: ExpenseFormData) => {
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, loadId: id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Expense added");
      fetchData();
    } catch {
      toast.error("Failed to save expense");
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      const res = await fetch(`/api/expenses/${expenseToDelete}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Expense removed");
      fetchData();
    } catch {
      toast.error("Could not delete expense");
    } finally {
      setExpenseToDelete(null);
    }
  };

  const handleFinalize = async () => {
    if (!currentUser?.id) { toast.error("You must be logged in to reconcile."); return; }
    setSubmitting(true);
    try {
      const payload = {
        loadId: id,
        userId: currentUser.id,
        updates: Object.entries(reconcileData).map(([orderId, data]) => ({
          orderId,
          ...data,
          finalAmount: orders.find((o) => o.id === orderId)?.currentAmount || 0,
        })),
        closeLoad: true,
      };
      const res = await fetch("/api/orders/loading/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success("Load Reconciled & Closed Successfully!");
      router.push("/dashboard/admin/orders/loading/history");
    } catch {
      toast.error("Failed to finalize reconciliation");
    } finally {
      setSubmitting(false);
    }
  };

  // Derived values
  const isCompleted = loadDetails?.status === "Completed";
  const isUserMissing = !currentUser?.id;

  // Consolidate returns
  const allReturns = useMemo(() => {
    const list: any[] = [];
    orders.forEach((o) => {
      if (o.returns) list.push(...o.returns);
    });
    return list;
  }, [orders]);
  const totalDispatchedValue = orders.reduce((sum, o) => sum + o.originalAmount, 0);
  const totalActualValue = orders.reduce((sum, o) => sum + o.currentAmount, 0);
  const totalDifference = totalActualValue - totalDispatchedValue;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netCollectedEst = totalActualValue - totalExpenses;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
        {/* ── Top Bar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/dashboard/admin/orders/loading/active")}
              className="h-9 w-9 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Reconcile Load: {loadDetails?.loadId}
                </h1>
                <Badge
                  variant={isCompleted ? "secondary" : "default"}
                  className={cn(
                    "text-xs font-semibold",
                    isCompleted
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-blue-100 text-blue-800 border-blue-200"
                  )}
                >
                  {loadDetails?.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vehicle: <strong className="text-foreground">{loadDetails?.lorryNumber}</strong> · Driver: <strong className="text-foreground">{loadDetails?.driverName}</strong>
              </p>
            </div>
          </div>

          {!isCompleted && (
            <div className="hidden md:flex items-center gap-2 self-end sm:self-auto">
              <Button
                size="default"
                className="bg-black hover:bg-gray-800 text-white font-medium shadow"
                onClick={handleFinalize}
                disabled={submitting || isUserMissing}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Finalize &amp; Close Load
              </Button>
            </div>
          )}
        </div>

        {isUserMissing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Warning</AlertTitle>
            <AlertDescription>
              Current session is missing or invalid. Please reload or log in again to reconcile this load.
            </AlertDescription>
          </Alert>
        )}

        {/* ── KPI Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-slate-50/70 border-slate-200">
            <CardHeader className="p-3 sm:p-4 pb-1">
              <CardDescription className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Dispatched Value
              </CardDescription>
              <CardTitle className="text-base sm:text-xl font-bold text-slate-800">
                LKR {totalDispatchedValue.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <span className="text-[11px] text-muted-foreground">{orders.length} Invoices</span>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-100">
            <CardHeader className="p-3 sm:p-4 pb-1">
              <CardDescription className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                Actual Value
              </CardDescription>
              <CardTitle className="text-base sm:text-xl font-bold text-blue-900">
                LKR {totalActualValue.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  totalDifference < 0
                    ? "text-red-600"
                    : totalDifference > 0
                    ? "text-green-600"
                    : "text-muted-foreground"
                )}
              >
                {totalDifference !== 0
                  ? `${totalDifference > 0 ? "+" : ""}LKR ${totalDifference.toLocaleString()} diff`
                  : "No change"}
              </span>
            </CardContent>
          </Card>

          <Card className="bg-amber-50/50 border-amber-100">
            <CardHeader className="p-3 sm:p-4 pb-1">
              <CardDescription className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                Total Expenses
              </CardDescription>
              <CardTitle className="text-base sm:text-xl font-bold text-amber-900">
                LKR {totalExpenses.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <span className="text-[11px] text-muted-foreground">{expenses.length} Entries</span>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/60 border-emerald-200">
            <CardHeader className="p-3 sm:p-4 pb-1">
              <CardDescription className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                Net To Collect
              </CardDescription>
              <CardTitle className="text-base sm:text-xl font-bold text-emerald-900">
                LKR {netCollectedEst.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <span className="text-[11px] text-emerald-700 font-medium">After all expenses</span>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT COLUMN: Returns & Expenses (1/3 width) */}
          <div className="space-y-6 lg:col-span-1 order-2 lg:order-1">
            {/* ── RETURNED ITEMS CARD ── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-rose-600" />
                    <CardTitle className="text-sm font-bold">Returned Items</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-white">
                    {allReturns.length} Items
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Physical condition of items received back from this load.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3">
                {allReturns.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    <Package className="h-6 w-6 mx-auto mb-1 opacity-40" />
                    No returns logged on this load.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allReturns.map((ret: ReconcileReturnItem) => {
                      const isExchange = ret.returnType === "Exchange";
                      const effectiveCondition = ret.actualCondition || (ret.returnType === "Good" ? "Good" : "Damage");
                      const isGood = effectiveCondition === "Good";
                      return (
                        <div
                          key={ret.id}
                          className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs text-slate-800 leading-tight">
                                {ret.productName}
                                {isExchange && (
                                  <span className="ml-1.5 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 align-middle">
                                    Exchange
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {ret.sku} · Qty: <strong>{ret.quantity}</strong>
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isCompleted}
                              onClick={() => handleToggleReturnType(ret.id, effectiveCondition)}
                              className={cn(
                                "h-6 text-[10px] font-bold px-2 shrink-0 transition-all",
                                isGood
                                  ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                                  : "bg-red-50 text-red-700 border-red-300 hover:bg-red-100"
                              )}
                              title="Click to toggle physical condition"
                            >
                              {isGood ? "✓ Good Stock" : "⚠ Damage"}
                            </Button>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-100">
                            <span>Ref: {ret.returnNumber}</span>
                            <span className="font-semibold font-mono text-slate-700">
                              LKR {ret.totalValue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── LOAD EXPENSES CARD ── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-amber-600" />
                    <CardTitle className="text-sm font-bold">Load Expenses</CardTitle>
                  </div>
                  {!isCompleted && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-50"
                      onClick={() => setIsExpenseDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  )}
                </div>
                <CardDescription className="text-xs">
                  Fuel, food, and other driver trip costs.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3">
                {expenses.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No expenses logged for this load.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 truncate">{exp.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {exp.category} · {new Date(exp.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="font-bold font-mono text-slate-900 shrink-0">
                          LKR {exp.amount.toLocaleString()}
                        </span>
                        {!isCompleted && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={() => setExpenseToDelete(exp.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="pt-2 border-t flex justify-between font-bold text-xs text-slate-900">
                      <span>Total Expenses</span>
                      <span className="font-mono text-amber-700">
                        LKR {totalExpenses.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Invoices Table (2/3 width) */}
          <div className="lg:col-span-2 order-1 lg:order-2 space-y-4">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3 bg-slate-50/50 border-b">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm font-bold">Delivery Invoices</CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Update delivery outcome, review returned products, or adjust invoice items.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono font-bold bg-white">
                  {orders.length} Total
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 text-[11px]">
                      <TableRow>
                        <TableHead className="font-bold pl-4">Invoice No</TableHead>
                        <TableHead className="font-bold">Customer</TableHead>
                        <TableHead className="font-bold text-right">Value (LKR)</TableHead>
                        <TableHead className="font-bold text-center w-36">Delivery Status</TableHead>
                        <TableHead className="font-bold text-right pr-4 w-28">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order, idx) => {
                        const rData = reconcileData[order.id];
                        const currentStatus = rData?.status || order.status;
                        const isCancelled = currentStatus === "Cancelled";
                        const hasReturns = (order.returns?.length || 0) > 0;

                        return (
                          <TableRow
                            key={order.id}
                            className={cn(
                              "text-xs transition-colors border-b",
                              isCancelled
                                ? "bg-red-50/40 text-muted-foreground"
                                : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                            )}
                          >
                            {/* Invoice Number */}
                            <TableCell className="pl-4">
                              <div className="font-bold font-mono text-slate-900">
                                {order.invoiceNo}
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                {order.orderId}
                              </span>
                            </TableCell>

                            {/* Customer */}
                            <TableCell>
                              <span className="font-medium text-slate-800 line-clamp-1">
                                {order.customer}
                              </span>
                              {hasReturns && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 text-[9px] font-medium bg-rose-50 text-rose-700 border-rose-200"
                                >
                                  {order.returns?.length} return item(s)
                                </Badge>
                              )}
                            </TableCell>

                            {/* Value */}
                            <TableCell className="text-right font-mono">
                              <div className="font-bold text-slate-900">
                                {order.currentAmount.toLocaleString()}
                              </div>
                              {order.currentAmount !== order.originalAmount && (
                                <span className="text-[10px] line-through text-muted-foreground block">
                                  {order.originalAmount.toLocaleString()}
                                </span>
                              )}
                            </TableCell>

                            {/* Delivery Status */}
                            <TableCell>
                              {isCompleted ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                                    currentStatus === "Pending" && "bg-gray-100 text-gray-600 border-gray-200",
                                    currentStatus === "Approved" && "bg-purple-100 text-purple-700 border-purple-200",
                                    currentStatus === "Processing" && "bg-indigo-100 text-indigo-700 border-indigo-200",
                                    currentStatus === "Checking" && "bg-cyan-100 text-cyan-700 border-cyan-200",
                                    currentStatus === "Loading" && "bg-blue-100 text-blue-700 border-blue-200",
                                    currentStatus === "Delivered" && "bg-green-100 text-green-700 border-green-200"
                                  )}
                                >
                                  {currentStatus}
                                </span>
                              ) : (
                                <Select
                                  value={currentStatus}
                                  onValueChange={(val) => handleStatusChange(order.id, val)}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "w-full h-8 text-xs font-medium border",
                                      currentStatus === "Pending" && "border-gray-200 bg-gray-50 text-gray-600",
                                      currentStatus === "Approved" && "border-purple-200 bg-purple-50 text-purple-700",
                                      currentStatus === "Processing" && "border-indigo-200 bg-indigo-50 text-indigo-700",
                                      currentStatus === "Checking" && "border-cyan-200 bg-cyan-50 text-cyan-700",
                                      currentStatus === "Loading" && "border-blue-200 bg-blue-50 text-blue-700",
                                      currentStatus === "Delivered" && "border-green-200 bg-green-50 text-green-700"
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Approved">Approved</SelectItem>
                                    <SelectItem value="Processing">Processing</SelectItem>
                                    <SelectItem value="Checking">Checking</SelectItem>
                                    <SelectItem value="Loading">Loading</SelectItem>
                                    <SelectItem value="Delivered">Delivered</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled={isCompleted}
                                  onClick={() => handleEditInvoice(order.invoiceId)}
                                  className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                  title="Edit Invoice"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Sticky Mobile Footer ── */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t shadow-lg px-4 py-3">
          <Button
            size="lg"
            className="w-full bg-black hover:bg-gray-800 text-white"
            onClick={handleFinalize}
            disabled={submitting || isUserMissing}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            Finalize &amp; Close Load
          </Button>
        </div>
      )}

      {/* ── Expense Add Dialog ── */}
      <ExpenseFormDialog
        open={isExpenseDialogOpen}
        onOpenChange={setIsExpenseDialogOpen}
        onSubmit={handleSubmitExpense}
        isLoadLocked={true}
        initialData={
          {
            description: "",
            amount: 0,
            category: "Fuel",
            expenseDate: new Date().toISOString().split("T")[0],
            paymentMethod: "Cash",
            referenceNo: "",
            loadId: id,
          } as any
        }
      />

      {/* ── Delete Expense Confirm ── */}
      <AlertDialog
        open={!!expenseToDelete}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this expense from the load? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteExpense}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
