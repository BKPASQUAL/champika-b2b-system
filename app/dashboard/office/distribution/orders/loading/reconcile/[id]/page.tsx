"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { clearReconcileTicks, useReconcileTicks, type TickSnapshot } from "@/hooks/useReconcileTicks";
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
  PackageOpen,
} from "lucide-react";
import { UnloadingReportDialog, type UnloadReturnInput } from "@/components/orders/UnloadingReportDialog";
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
  returnNoteNumber?: string | null;
  invoiceNo: string;
  customer: string;
  currentAmount: number;
  originalAmount: number;
  editCount: number; // invoice edit-history entries
  status: string;
  paymentStatus: string;
  returns?: ReconcileReturnItem[];
}

// Status/notes picked on this page are saved per load in the browser
const reconcileStateKey = (loadId: string) => `reconcile-state:${loadId}`;
function readSavedReconcile(loadId: string): ReconcileState {
  try {
    const raw = localStorage.getItem(reconcileStateKey(loadId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// What a tick remembers about an invoice (see hooks/useReconcileTicks.ts)
const snapshotOf = (o: OrderItem): TickSnapshot => ({
  amount: o.currentAmount,
  edits: o.editCount,
  returnsSig: (o.returns || [])
    .map((r) => `${r.id}:${r.quantity}:${r.actualCondition || r.returnType}`)
    .sort()
    .join("|"),
});

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  category: string;
}

interface ReconcileState {
  [orderId: string]: {
    status: string;
    paymentStatus: string;
    notes: string;
  };
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: (props: { className?: string }) => React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("border", highlight && "border-black bg-black text-white")}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", highlight ? "bg-white/10" : "bg-slate-100")}>
          <Icon className={cn("w-5 h-5", highlight ? "text-white" : "text-slate-600")} />
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium truncate", highlight ? "text-white/70" : "text-muted-foreground")}>
            {label}
          </p>
          <p className={cn("text-base font-bold leading-tight", highlight ? "text-white" : "")}>{value}</p>
          {sub && (
            <p className={cn("text-xs truncate", highlight ? "text-white/60" : "text-muted-foreground")}>{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OfficeReconcileLoadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  // This page is also used by the admin portal (re-exported there)
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/dashboard/admin");
  const basePath = isAdmin ? "/dashboard/admin" : "/dashboard/office/distribution";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadDetails, setLoadDetails] = useState<any>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loadExpenses, setLoadExpenses] = useState<ExpenseItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [reconcileData, setReconcileData] = useState<ReconcileState>({});
  const [unloadOpen, setUnloadOpen] = useState(false);

  // Inputs for the Unloading Report: statuses picked here + returns collected
  const unloadStatuses = useMemo(() => {
    const m: Record<string, string> = {};
    Object.entries(reconcileData).forEach(([oid, s]) => (m[oid] = s.status));
    return m;
  }, [reconcileData]);
  const unloadReturns = useMemo<UnloadReturnInput[]>(
    () =>
      orders.flatMap((o) =>
        (o.returns || []).map((r) => ({
          orderId: o.id,
          invoiceNo: o.invoiceNo,
          customer: o.customer,
          productId: r.productId,
          productName: r.productName,
          sku: r.sku,
          quantity: r.quantity,
          // Same rule as the Lorry Returns Summary: unless marked Good
          // (or a plain Good return), it's a damaged return
          condition: (r.actualCondition || (r.returnType === "Good" ? "Good" : "Damage")) as "Good" | "Damage",
          returnType: r.returnType,
        }))
      ),
    [orders]
  );

  // ── Per-invoice "checked" ticks ──
  const tickItems = useMemo(
    () => (loading ? null : orders.map((o) => ({ id: o.id, snapshot: snapshotOf(o) }))),
    [orders, loading]
  );
  const ticks = useReconcileTicks(id, tickItems);
  // Cancelled orders don't need checking
  const tickable = orders.filter((o) => reconcileData[o.id]?.status !== "Cancelled");
  const tickedCount = tickable.filter((o) => ticks.isTicked(o.id)).length;
  const allTicked = tickable.length > 0 && tickedCount === tickable.length;

  const fetchData = async () => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed?.id) setCurrentUser(parsed);
          } catch {}
        }
      }

      const res = await fetch(`/api/orders/loading/history/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLoadDetails(data);

      const expRes = await fetch("/api/expenses");
      if (expRes.ok) {
        const allExpenses = await expRes.json();
        setLoadExpenses(allExpenses.filter((e: any) => e.loadId === id));
      }

      const ordersWithHistory = await Promise.all(
        data.orders.map(async (o: any) => {
          let originalAmount = o.totalAmount;
          let editCount = 0;
          if (o.invoiceId) {
            try {
              const histRes = await fetch(`/api/invoices/${o.invoiceId}/history`);
              if (histRes.ok) {
                const history = await histRes.json();
                // Only real edits count; status changes are also in history
                // but don't carry an amount. History is newest first, so the
                // last edit holds the amount the invoice was created with.
                const edits = (history || []).filter((h: any) => h.isAmountEdit);
                editCount = edits.length;
                if (edits.length > 0) originalAmount = Number(edits[edits.length - 1].previousTotal) || 0;
              }
            } catch {}
          }
          return {
            id: o.id,
            orderId: o.orderId,
            invoiceId: o.invoiceId,
            returnNoteNumber: o.returnNoteNumber || null,
            invoiceNo: o.invoiceNo || "N/A",
            customer: o.customer.shopName,
            currentAmount: o.totalAmount,
            originalAmount,
            editCount,
            status: o.status,
            paymentStatus: "Credit",
            returns: o.returns || [],
          };
        })
      );

      setOrders(ordersWithHistory);
      setReconcileData((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        // Restore status/notes picked before leaving to edit an invoice
        const saved = readSavedReconcile(id);
        const init: ReconcileState = {};
        ordersWithHistory.forEach((o: OrderItem) => {
          const defaultStatus =
            o.status === "In Transit" || o.status === "Loading" ? "Delivered" : o.status;
          const s = saved[o.id];
          init[o.id] = {
            // A saved pick only applies while the order is still on the lorry
            status: s?.status && (o.status === "In Transit" || o.status === "Loading") ? s.status : defaultStatus,
            paymentStatus: s?.paymentStatus || "Credit",
            notes: s?.notes || "",
          };
        });
        return init;
      });
    } catch {
      toast.error("Failed to load delivery sheet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [id]);

  // Save status/notes picks so they survive going to the invoice edit page
  useEffect(() => {
    if (loading || Object.keys(reconcileData).length === 0) return;
    if (loadDetails?.status === "Completed") return;
    try {
      localStorage.setItem(reconcileStateKey(id), JSON.stringify(reconcileData));
    } catch {
      /* storage unavailable */
    }
  }, [reconcileData, loading, id, loadDetails?.status]);

  const updateOrderState = (orderId: string, field: string, value: any) => {
    if (loadDetails?.status === "Completed") return;
    setReconcileData((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [field]: value },
    }));
  };

  // Set a returned item's physical condition (Good / Damage).
  // Exchange returns: only actual_condition is saved, so they keep showing as
  // "Exchange"; stock moves when the load is finalized.
  // Normal returns: the return type itself is Good or Damage.
  const handleSetReturnCondition = async (ret: ReconcileReturnItem, condition: "Good" | "Damage") => {
    if (loadDetails?.status === "Completed") {
      toast.info("Load is completed. Returns cannot be modified.");
      return;
    }
    const isExchange = ret.returnType === "Exchange";
    const patch = (r: ReconcileReturnItem): ReconcileReturnItem =>
      isExchange ? { ...r, actualCondition: condition } : { ...r, returnType: condition, actualCondition: null };

    // Show the change straight away
    const previous = orders;
    setOrders((prev) =>
      prev.map((o) => ({ ...o, returns: o.returns?.map((r) => (r.id === ret.id ? patch(r) : r)) }))
    );

    try {
      const res = await fetch(`/api/inventory/returns/${ret.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isExchange ? { actual_condition: condition } : { return_type: condition }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "");
      toast.success(`${ret.productName} marked as ${condition}`);
    } catch (e: any) {
      setOrders(previous);
      toast.error(e.message || "Failed to update return condition");
    }
  };

  const handleEditInvoice = (invoiceId: string | null, returnNoteNumber?: string | null) => {
    if (loadDetails?.status === "Completed") {
      toast.info("Load is completed. Invoices cannot be edited.");
      return;
    }
    // Return-note pickups are edited on the return note itself
    if (returnNoteNumber) {
      router.push(
        `${basePath}/inventory/returns/${encodeURIComponent(returnNoteNumber)}?edit=1&returnTo=${basePath}/orders/loading/reconcile/${id}`
      );
      return;
    }
    if (!invoiceId) { toast.error("Invoice not found"); return; }
    router.push(
      `${basePath}/invoices/${invoiceId}/edit?returnTo=${basePath}/orders/loading/reconcile/${id}`
    );
  };

  const handleSubmitExpense = async (data: ExpenseFormData) => {
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, loadId: id, businessId: BUSINESS_IDS.CHAMPIKA_DISTRIBUTION }),
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
    if (!allTicked) {
      toast.error(`Please check and tick every invoice first (${tickable.length - tickedCount} left).`);
      return;
    }
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
      clearReconcileTicks(id);
      try {
        localStorage.removeItem(reconcileStateKey(id));
      } catch {
        /* ignore */
      }
      router.push(`${basePath}/orders/loading/history`);
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
  const totalFinalValue = orders.reduce((sum, o) => sum + o.currentAmount, 0);
  const totalExpenses = loadExpenses.reduce((sum, e) => sum + e.amount, 0);
  const valueDiff = totalFinalValue - totalDispatchedValue;

  const pendingCount = Object.values(reconcileData).filter((s) => s.status === "Pending").length;
  const approvedCount = Object.values(reconcileData).filter((s) => s.status === "Approved").length;
  const processingCount = Object.values(reconcileData).filter((s) => s.status === "Processing").length;
  const checkingCount = Object.values(reconcileData).filter((s) => s.status === "Checking").length;
  const loadingCount = Object.values(reconcileData).filter((s) => s.status === "Loading").length;
  const deliveredCount = Object.values(reconcileData).filter((s) => s.status === "Delivered").length;

  const deliveredValue = orders.reduce((sum, o) => {
    const s = reconcileData[o.id]?.status;
    return s === "Delivered" ? sum + o.currentAmount : sum;
  }, 0);


  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-md bg-gray-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-56 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 pb-24">

        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">Reconcile Delivery</h1>
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  Office
                </Badge>
                {isCompleted && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
                  {loadDetails?.loadId}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Truck className="w-3.5 h-3.5" />
                  {loadDetails?.lorryNumber}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  {orders.length} orders
                </span>
                {currentUser ? (
                  <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-100">
                    <User className="w-3 h-3" />
                    Reconciling as <strong className="ml-0.5">{currentUser.name}</strong>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-medium border border-red-100">
                    <AlertCircle className="w-3 h-3" /> Not Logged In
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop action button */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              size="lg"
              variant="outline"
              className="border-orange-200 text-orange-700 hover:bg-orange-50 w-full sm:w-auto"
              onClick={() => setUnloadOpen(true)}
            >
              <PackageOpen className="w-4 h-4 mr-2" /> Unloading Report
            </Button>
            <div className="hidden md:block">
            {isCompleted ? (
              <Button
                size="lg"
                variant="outline"
                disabled
                className="bg-green-50 text-green-700 border-green-200 opacity-100"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Load Completed
              </Button>
            ) : (
              <Button
                size="lg"
                className="bg-black hover:bg-gray-800 text-white shadow-md"
                onClick={handleFinalize}
                disabled={submitting || isUserMissing || !allTicked}
                title={allTicked ? undefined : "Tick every invoice to enable"}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                {allTicked
                  ? "Finalize & Close Load"
                  : `Tick all invoices (${tickable.length - tickedCount} left)`}
              </Button>
            )}
            </div>
          </div>
        </div>

        {/* ── Auth Alert ── */}
        {isUserMissing && !isCompleted && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Session Required</AlertTitle>
            <AlertDescription>
              No valid session found. Please log out and log in again before reconciling.
            </AlertDescription>
          </Alert>
        )}

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            label="Final Order Value"
            value={`LKR ${totalFinalValue.toLocaleString()}`}
            sub={
              valueDiff !== 0
                ? `${valueDiff > 0 ? "+" : ""}${valueDiff.toLocaleString()} vs dispatched`
                : `Dispatched: ${totalDispatchedValue.toLocaleString()}`
            }
            icon={Package}
          />
          <KpiCard
            label="Total Expenses"
            value={`LKR ${totalExpenses.toLocaleString()}`}
            sub="Fuel, meals & misc"
            icon={TrendingDown}
          />
          <KpiCard
            label="Delivered Value"
            value={`LKR ${deliveredValue.toLocaleString()}`}
            sub={`${deliveredCount} of ${orders.length} orders delivered`}
            icon={CheckCircle2}
            highlight
          />
        </div>

        {/* ── Order Status Strip ── */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground font-medium">Status:</span>
          {pendingCount > 0 && (
            <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
              {pendingCount} Pending
            </Badge>
          )}
          {approvedCount > 0 && (
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
              {approvedCount} Approved
            </Badge>
          )}
          {processingCount > 0 && (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
              {processingCount} Processing
            </Badge>
          )}
          {checkingCount > 0 && (
            <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-100">
              {checkingCount} Checking
            </Badge>
          )}
          {loadingCount > 0 && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
              {loadingCount} Loading
            </Badge>
          )}
          {deliveredCount > 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
              {deliveredCount} Delivered
            </Badge>
          )}
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div className="grid gap-5 md:grid-cols-3">

          {/* Left: Expenses & Returns Summary */}
          <div className="md:col-span-1 space-y-5">
            <Card className="md:sticky md:top-4">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Load Expenses</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Fuel, meals &amp; miscellaneous
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsExpenseDialogOpen(true)}
                  disabled={isCompleted}
                  className="shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent>
                {loadExpenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                    <Receipt className="w-7 h-7 text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">No expenses yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      Add fuel, tolls, meals, etc.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loadExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border bg-white hover:bg-slate-50 transition-colors group"
                      >
                        <div className="p-1.5 bg-red-50 text-red-600 rounded-md shrink-0">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{exp.category}</p>
                          <p
                            className="text-xs text-muted-foreground truncate"
                            title={exp.description}
                          >
                            {exp.description || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-sm font-bold">
                            {exp.amount.toLocaleString()}
                          </span>
                          {!isCompleted && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                              onClick={() => setExpenseToDelete(exp.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    <Separator className="my-2" />
                    <div className="flex justify-between items-center px-1">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="font-mono text-sm font-bold text-red-600">
                        LKR {totalExpenses.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lorry Returns Summary Card */}
            {allReturns.length > 0 && (
              <Card className="md:sticky md:top-[380px]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between text-orange-950 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Undo2 className="w-5 h-5 text-orange-600" />
                      Lorry Returns Summary
                    </span>
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                      Shop by Shop
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Click Good / Damage buttons to set item condition before closing load
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {orders
                      .filter((o) => o.returns && o.returns.length > 0)
                      .map((o) => (
                        <div key={o.id} className="p-3 rounded-xl border border-orange-100 bg-orange-50/20 space-y-2">
                          <div className="flex justify-between items-center border-b border-orange-100 pb-1.5">
                            <div>
                              <span className="font-bold text-xs text-slate-900 block truncate max-w-[180px]">
                                {o.customer}
                              </span>
                              <span className="text-[10px] text-orange-700 font-mono">
                                Invoice: {o.invoiceNo}
                              </span>
                            </div>
                            <span className="text-xs font-bold font-mono text-orange-700">
                              LKR {o.returns?.reduce((s, r) => s + r.totalValue, 0).toLocaleString()}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {o.returns?.map((ret) => {
                              const isExchange = ret.returnType === "Exchange";
                              const effectiveCondition = ret.actualCondition || (ret.returnType === "Good" ? "Good" : "Damage");
                              const isGood = effectiveCondition === "Good";
                              return (
                                <div key={ret.id} className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-xs text-slate-800 truncate" title={ret.productName}>
                                      {ret.productName}
                                      {isExchange && (
                                        <span className="ml-1.5 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 align-middle">
                                          Exchange
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      {ret.sku} · {ret.quantity} Pcs · LKR {ret.totalValue.toLocaleString()}
                                    </p>
                                  </div>
                                  {/* Good / Damage — the selected one is filled */}
                                  <div className="flex shrink-0 rounded-md border border-slate-200 overflow-hidden">
                                    <button
                                      type="button"
                                      disabled={isCompleted}
                                      onClick={() => !isGood && handleSetReturnCondition(ret, "Good")}
                                      className={cn(
                                        "h-6 px-2 text-[10px] font-bold transition-colors disabled:cursor-not-allowed",
                                        isGood
                                          ? "bg-green-600 text-white"
                                          : "bg-white text-slate-500 hover:bg-green-50 hover:text-green-700"
                                      )}
                                      title="Mark as good stock"
                                    >
                                      ✓ Good
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isCompleted}
                                      onClick={() => isGood && handleSetReturnCondition(ret, "Damage")}
                                      className={cn(
                                        "h-6 px-2 text-[10px] font-bold border-l border-slate-200 transition-colors disabled:cursor-not-allowed",
                                        !isGood
                                          ? "bg-red-600 text-white"
                                          : "bg-white text-slate-500 hover:bg-red-50 hover:text-red-700"
                                      )}
                                      title="Mark as damaged"
                                    >
                                      ⚠ Damage
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex justify-between items-center px-1">
                    <span className="text-sm font-semibold">Total Returns Value</span>
                    <span className="font-mono text-sm font-bold text-orange-600">
                      LKR {allReturns.reduce((sum: number, r: any) => sum + r.totalValue, 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Order Table */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <CardTitle>Order Reconciliation</CardTitle>
                    <CardDescription>
                      {isCompleted
                        ? "This load has been closed. Records are locked."
                        : "Check each invoice and tick it. All invoices must be ticked before closing the load."}
                    </CardDescription>
                  </div>
                  {!isCompleted && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0",
                        allTicked
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {tickedCount} / {tickable.length} checked
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="pl-4 w-10">
                          <Checkbox
                            aria-label="Tick all invoices"
                            disabled={isCompleted || tickable.length === 0}
                            checked={isCompleted || allTicked}
                            onCheckedChange={(v) =>
                              ticks.setAll(
                                tickable.map((o) => ({ id: o.id, snapshot: snapshotOf(o) })),
                                v === true
                              )
                            }
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                          />
                        </TableHead>
                        <TableHead className="min-w-[110px]">Invoice</TableHead>
                        <TableHead className="min-w-[130px]">Customer</TableHead>
                        <TableHead className="min-w-[100px]">Returns</TableHead>
                        <TableHead className="min-w-[150px]">Delivery Status</TableHead>
                        <TableHead className="text-right min-w-[90px]">Amount (LKR)</TableHead>
                        <TableHead className="text-right w-[65px]">Diff</TableHead>
                        <TableHead className="min-w-[130px]">Notes</TableHead>
                        <TableHead className="text-center w-12">Edit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order, idx) => {
                        const state = reconcileData[order.id] || {};
                        const currentStatus = state.status || "Delivered";
                        const diff = order.currentAmount - order.originalAmount;
                        const isCancelled = currentStatus === "Cancelled";
                        const ticked = isCompleted || ticks.isTicked(order.id);
                        const change = !isCompleted && !ticked ? ticks.changeFor(order.id) : undefined;

                        return (
                          <TableRow
                            key={order.id}
                            className={cn(
                              "transition-colors",
                              isCancelled
                                ? "bg-rose-50/40 opacity-70"
                                : change
                                  ? "bg-amber-50 hover:bg-amber-100/60"
                                  : ticked && !isCompleted
                                    ? "bg-green-50/50"
                                    : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                            )}
                          >
                            {/* Checked tick */}
                            <TableCell className="pl-4 align-top pt-4">
                              <Checkbox
                                aria-label={`Tick ${order.invoiceNo}`}
                                disabled={isCompleted || isCancelled}
                                checked={ticked}
                                onCheckedChange={(v) => ticks.setTicked(order.id, snapshotOf(order), v === true)}
                                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                              />
                            </TableCell>

                            {/* Invoice Number — primary identifier */}
                            <TableCell>
                              <div className="text-sm font-bold font-mono tracking-wide">
                                {order.invoiceNo}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {order.orderId}
                              </div>
                              {change && (
                                <div className="mt-1 inline-flex flex-col gap-0.5 rounded border border-amber-300 bg-amber-100 px-1.5 py-1 text-[10px] font-medium text-amber-800">
                                  <span className="font-bold uppercase tracking-wide">Changed — re-check</span>
                                  {Math.abs(change.toAmount - change.fromAmount) > 0.005 && (
                                    <span className="font-mono">
                                      LKR {change.fromAmount.toLocaleString()} → {change.toAmount.toLocaleString()}
                                    </span>
                                  )}
                                  {change.edited && <span>Invoice items edited</span>}
                                  {change.returnsChanged && <span>Returns changed</span>}
                                </div>
                              )}
                            </TableCell>

                            <TableCell>
                              <span
                                className="text-sm block max-w-[140px] truncate"
                                title={order.customer}
                              >
                                {order.customer}
                              </span>
                            </TableCell>

                            {/* Returns */}
                            <TableCell>
                              {order.returns && order.returns.length > 0 ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs border-orange-200 bg-orange-50/30 text-orange-850 hover:bg-orange-100 flex items-center gap-1">
                                      <Undo2 className="w-3 h-3 text-orange-600" />
                                      {order.returns.length} Return{order.returns.length !== 1 ? "s" : ""}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-3" align="start">
                                    <div className="space-y-2">
                                      <h4 className="font-bold text-xs text-orange-800 uppercase tracking-wider flex items-center gap-1 border-b pb-1">
                                        <Undo2 className="w-3.5 h-3.5" /> Return Details
                                      </h4>
                                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                                        {order.returns.map((ret) => (
                                          <div key={ret.id} className="text-xs flex justify-between gap-2 border-b border-slate-100 pb-1 last:border-0">
                                            <div className="min-w-0">
                                              <p className="font-semibold text-slate-800 truncate">{ret.productName}</p>
                                              <p className="text-[10px] text-muted-foreground font-mono">{ret.sku} · {ret.returnType}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <p className="font-semibold">{ret.quantity} unit{ret.quantity !== 1 ? "s" : ""}</p>
                                              <p className="text-[10px] text-orange-600 font-bold">LKR {ret.totalValue.toLocaleString()}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
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
                                    currentStatus === "Delivered" && "bg-green-100 text-green-700 border-green-200",
                                  )}
                                >
                                  {currentStatus}
                                </span>
                              ) : (
                                <Select
                                  value={currentStatus}
                                  onValueChange={(val) => updateOrderState(order.id, "status", val)}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "w-full h-8 text-xs font-medium border",
                                      currentStatus === "Pending" && "border-gray-200 bg-gray-50 text-gray-600",
                                      currentStatus === "Approved" && "border-purple-200 bg-purple-50 text-purple-700",
                                      currentStatus === "Processing" && "border-indigo-200 bg-indigo-50 text-indigo-700",
                                      currentStatus === "Checking" && "border-cyan-200 bg-cyan-50 text-cyan-700",
                                      currentStatus === "Loading" && "border-blue-200 bg-blue-50 text-blue-700",
                                      currentStatus === "Delivered" && "border-green-200 bg-green-50 text-green-700",
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {/* Only Delivered, or back to Loading */}
                                    <SelectItem value="Delivered">Delivered</SelectItem>
                                    <SelectItem value="Loading">Loading</SelectItem>
                                    {!["Delivered", "Loading"].includes(currentStatus) && (
                                      <SelectItem value={currentStatus} disabled>
                                        {currentStatus}
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <span className="font-mono text-sm font-bold">
                                {order.currentAmount.toLocaleString()}
                              </span>
                            </TableCell>

                            <TableCell className="text-right">
                              {diff !== 0 ? (
                                <span
                                  className={cn(
                                    "text-xs font-mono font-bold",
                                    diff > 0 ? "text-green-600" : "text-red-600"
                                  )}
                                >
                                  {diff > 0 ? "+" : ""}
                                  {diff.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>

                            <TableCell>
                              <Input
                                disabled={isCompleted || isCancelled}
                                placeholder="Add note..."
                                value={state.notes || ""}
                                onChange={(e) =>
                                  updateOrderState(order.id, "notes", e.target.value)
                                }
                                className="h-8 text-xs bg-white border-slate-200 focus:border-slate-400 disabled:cursor-not-allowed"
                              />
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isCompleted || isCancelled}
                                onClick={() => handleEditInvoice(order.invoiceId, order.returnNoteNumber)}
                                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                                title={isCancelled ? "Order cancelled" : order.returnNoteNumber ? "Edit Return Note" : "Edit Invoice"}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
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
            disabled={submitting || isUserMissing || !allTicked}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            {allTicked
              ? "Finalize & Close Load"
              : `Tick all invoices (${tickable.length - tickedCount} left)`}
          </Button>
        </div>
      )}

      {/* ── Unloading Report ── */}
      <UnloadingReportDialog
        open={unloadOpen}
        onOpenChange={setUnloadOpen}
        loadId={id}
        statuses={unloadStatuses}
        returns={unloadReturns}
      />

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
              className="bg-red-600 hover:bg-red-700"
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
