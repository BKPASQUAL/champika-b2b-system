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
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExpenseFormDialog } from "@/app/dashboard/admin/expenses/_components/ExpenseDialogs";
import { ExpenseFormData } from "@/app/dashboard/admin/expenses/types";
import { cn } from "@/lib/utils";
import { BUSINESS_IDS } from "@/app/config/business-constants";

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
}

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

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadDetails, setLoadDetails] = useState<any>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loadExpenses, setLoadExpenses] = useState<ExpenseItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [reconcileData, setReconcileData] = useState<ReconcileState>({});

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
          if (o.invoiceId) {
            try {
              const histRes = await fetch(`/api/invoices/${o.invoiceId}/history`);
              if (histRes.ok) {
                const history = await histRes.json();
                if (history.length > 0) originalAmount = history[history.length - 1].previousTotal;
              }
            } catch {}
          }
          return {
            id: o.id,
            orderId: o.orderId,
            invoiceId: o.invoiceId,
            invoiceNo: o.invoiceNo || "N/A",
            customer: o.customer.shopName,
            currentAmount: o.totalAmount,
            originalAmount,
            status: o.status,
            paymentStatus: "Credit",
          };
        })
      );

      setOrders(ordersWithHistory);
      setReconcileData((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const init: ReconcileState = {};
        ordersWithHistory.forEach((o: OrderItem) => {
          init[o.id] = {
            status: o.status === "In Transit" || o.status === "Loading" ? "Delivered" : o.status,
            paymentStatus: "Credit",
            notes: "",
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

  const updateOrderState = (orderId: string, field: string, value: any) => {
    if (loadDetails?.status === "Completed") return;
    setReconcileData((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [field]: value },
    }));
  };

  const handleEditInvoice = (invoiceId: string | null) => {
    if (loadDetails?.status === "Completed") {
      toast.info("Load is completed. Invoices cannot be edited.");
      return;
    }
    if (!invoiceId) { toast.error("Invoice not found"); return; }
    router.push(
      `/dashboard/office/distribution/invoices/${invoiceId}/edit?returnTo=/dashboard/office/distribution/orders/loading/reconcile/${id}`
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
      router.push("/dashboard/office/distribution/orders/loading/history");
    } catch {
      toast.error("Failed to finalize reconciliation");
    } finally {
      setSubmitting(false);
    }
  };

  // Derived values
  const isCompleted = loadDetails?.status === "Completed";
  const isUserMissing = !currentUser?.id;
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
          <div className="hidden md:block shrink-0">
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
                disabled={submitting || isUserMissing}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Finalize & Close Load
              </Button>
            )}
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

          {/* Left: Expenses */}
          <div className="md:col-span-1">
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
          </div>

          {/* Right: Order Table */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Order Reconciliation</CardTitle>
                <CardDescription>
                  {isCompleted
                    ? "This load has been closed. Records are locked."
                    : "Set delivery status and payment method for each invoice."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="pl-4 min-w-[110px]">Invoice</TableHead>
                        <TableHead className="min-w-[130px]">Customer</TableHead>
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

                        return (
                          <TableRow
                            key={order.id}
                            className={cn(
                              "transition-colors",
                              isCancelled
                                ? "bg-rose-50/40 opacity-70"
                                : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                            )}
                          >
                            {/* Invoice Number — primary identifier */}
                            <TableCell className="pl-4">
                              <div className="text-sm font-bold font-mono tracking-wide">
                                {order.invoiceNo}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {order.orderId}
                              </div>
                            </TableCell>

                            <TableCell>
                              <span
                                className="text-sm block max-w-[140px] truncate"
                                title={order.customer}
                              >
                                {order.customer}
                              </span>
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
                                    <SelectItem value="Approved">Approved</SelectItem>
                                    <SelectItem value="Processing">Processing</SelectItem>
                                    <SelectItem value="Checking">Checking</SelectItem>
                                    <SelectItem value="Loading">Loading</SelectItem>
                                    <SelectItem value="Delivered">Delivered</SelectItem>
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
                                onClick={() => handleEditInvoice(order.invoiceId)}
                                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                                title={isCancelled ? "Order cancelled" : "Edit Invoice"}
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
