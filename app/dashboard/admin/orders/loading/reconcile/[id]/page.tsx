// app/dashboard/admin/orders/loading/reconcile/[id]/page.tsx
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
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Import Expense Components
// Adjust the path based on your folder structure if needed
import { ExpenseFormDialog } from "@/app/dashboard/admin/expenses/_components/ExpenseDialogs";
import { ExpenseFormData } from "@/app/dashboard/admin/expenses/types";

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

export default function ReconcileLoadPage({
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
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Dialog State
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  // State to track status/notes
  const [reconcileData, setReconcileData] = useState<ReconcileState>({});

  const fetchData = async () => {
    try {
      // 1. Load User
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("currentUser");
        if (stored) {
          try {
            const parsedUser = JSON.parse(stored);
            if (parsedUser && parsedUser.id) {
              setCurrentUser(parsedUser);
            }
          } catch (e) {
            console.error("Error parsing user session");
          }
        }
      }

      // 2. Load Sheet Details
      const res = await fetch(`/api/orders/loading/history/${id}`);
      if (!res.ok) throw new Error("Failed to load data");
      const data = await res.json();
      setLoadDetails(data);

      // 3. Load Expenses for this Load
      // We fetch all and filter client-side for simplicity, or use a filtered API if available
      const expRes = await fetch("/api/expenses");
      if (expRes.ok) {
        const allExpenses = await expRes.json();
        // Filter expenses strictly for this loadId
        const linkedExpenses = allExpenses.filter((e: any) => e.loadId === id);
        setLoadExpenses(linkedExpenses);
      }

      // 4. Fetch History for Differences
      const ordersWithHistory = await Promise.all(
        data.orders.map(async (o: any) => {
          let originalAmount = o.totalAmount;

          if (o.invoiceId) {
            try {
              const histRes = await fetch(
                `/api/invoices/${o.invoiceId}/history`
              );
              if (histRes.ok) {
                const history = await histRes.json();
                if (history.length > 0) {
                  originalAmount = history[history.length - 1].previousTotal;
                }
              }
            } catch (err) {
              console.error("Failed to load history for", o.invoiceId);
            }
          }

          return {
            id: o.id,
            orderId: o.orderId,
            invoiceId: o.invoiceId,
            invoiceNo: o.invoiceNo || "N/A",
            customer: o.customer.shopName,
            currentAmount: o.totalAmount,
            originalAmount: originalAmount,
            status: o.status,
            paymentStatus: "Credit",
          };
        })
      );

      setOrders(ordersWithHistory);

      // Initialize Reconcile State if empty
      setReconcileData((prev) => {
        if (Object.keys(prev).length > 0) return prev; // Don't overwrite if already editing
        const initialState: ReconcileState = {};
        ordersWithHistory.forEach((o: OrderItem) => {
          initialState[o.id] = {
            status:
              o.status === "In Transit" || o.status === "Loading"
                ? "Delivered"
                : o.status,
            paymentStatus: "Credit",
            notes: "",
          };
        });
        return initialState;
      });
    } catch (error) {
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
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  const handleEditInvoice = (invoiceId: string | null) => {
    if (loadDetails?.status === "Completed") {
      toast.info("Load is completed. Invoices cannot be edited from here.");
      return;
    }
    if (!invoiceId) {
      toast.error("Invoice not found");
      return;
    }
    router.push(
      `/dashboard/admin/invoices/${invoiceId}/edit?returnTo=/dashboard/admin/orders/loading/reconcile/${id}`
    );
  };

  // --- Expense Handlers ---

  const handleAddExpense = () => {
    setIsExpenseDialogOpen(true);
  };

  const handleSubmitExpense = async (data: ExpenseFormData) => {
    try {
      // Force the loadId to be the current page's ID
      const payload = {
        ...data,
        loadId: id,
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add expense");

      toast.success("Expense added to load");
      fetchData(); // Refresh data to show new expense
    } catch (error) {
      console.error(error);
      toast.error("Failed to save expense");
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Remove this expense from the load?")) return;
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Expense removed");
      fetchData();
    } catch (error) {
      toast.error("Could not delete expense");
    }
  };

  const handleFinalize = async () => {
    if (!currentUser?.id) {
      toast.error("You must be logged in to reconcile.");
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

      if (!res.ok) throw new Error("Failed to save reconciliation");

      toast.success("Load Reconciled & Closed Successfully!");
      router.push("/dashboard/admin/orders/loading/history");
    } catch (error) {
      toast.error("Failed to finalize reconciliation");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCompleted = loadDetails?.status === "Completed";
  const isUserMissing = !currentUser?.id;

  // Stats Calculations
  const totalDispatchedValue = orders.reduce(
    (sum, order) => sum + order.originalAmount,
    0
  );
  const totalFinalValue = orders.reduce(
    (sum, order) => sum + order.currentAmount,
    0
  );
  const totalExpenses = loadExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Cash Calculation: Final Sales - Expenses
  const expectedCash = totalFinalValue - totalExpenses;

  const valueDifference = totalFinalValue - totalDispatchedValue;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Reconcile Delivery
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1 text-muted-foreground text-sm">
              <span>{loadDetails?.loadId}</span>
              <span className="hidden sm:inline">•</span>
              <span>{loadDetails?.lorryNumber}</span>
              <span className="hidden sm:inline">•</span>
              {currentUser ? (
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-100">
                  <User className="w-3 h-3" />
                  Reconciling as: <strong>{currentUser.name}</strong>
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium border border-red-100">
                  <User className="w-3 h-3" /> Not Logged In
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {isCompleted ? (
          <Button
            size="lg"
            variant="outline"
            disabled
            className="bg-green-50 text-green-700 border-green-200 opacity-100"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Load Completed
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

      {/* Warning for Missing User */}
      {isUserMissing && !isCompleted && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            You are not logged in with a valid session ID. Please log out and
            log in again to reconcile this load.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Stats & Expenses */}
        <div className="space-y-6 md:col-span-1">
          {/* Summary Card */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Original Value</span>
                <span>{totalDispatchedValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Final Order Value</span>
                <span className="font-semibold">
                  {totalFinalValue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Expenses</span>
                <span className="text-red-600">
                  - {totalExpenses.toLocaleString()}
                </span>
              </div>
              <div className="border-t pt-3 mt-2 flex justify-between items-center">
                <span className="font-bold">Net Cash Expected</span>
                <Badge
                  variant="outline"
                  className="text-lg px-3 py-1 bg-white border-slate-300"
                >
                  LKR {expectedCash.toLocaleString()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Expenses Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base">Load Expenses</CardTitle>
                <CardDescription>Fuel, meals, etc.</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddExpense}
                disabled={isCompleted}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {loadExpenses.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                  No expenses added
                </div>
              ) : (
                <div className="space-y-3">
                  {loadExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex justify-between items-center p-2 rounded-md bg-white border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 text-red-600 rounded-full">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{exp.category}</p>
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[120px]"
                            title={exp.description}
                          >
                            {exp.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold">
                          {exp.amount.toLocaleString()}
                        </span>
                        {!isCompleted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteExpense(exp.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-right text-sm font-medium text-muted-foreground border-t">
                    Total: LKR {totalExpenses.toLocaleString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order Table */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Order Reconciliation</CardTitle>
              <CardDescription>
                {isCompleted
                  ? "Load completed. Records locked."
                  : "Update statuses and edit amounts if necessary."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[100px]">Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                      <TableHead className="w-[150px]">Notes</TableHead>
                      <TableHead className="text-right">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const state = reconcileData[order.id] || {};
                      const diff = order.currentAmount - order.originalAmount;

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            <div className="text-sm">{order.orderId}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {order.invoiceNo}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-sm truncate block max-w-[120px]"
                              title={order.customer}
                            >
                              {order.customer}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={isCompleted}
                              value={state.status || "Delivered"}
                              onValueChange={(val) =>
                                updateOrderState(order.id, "status", val)
                              }
                            >
                              <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Delivered">
                                  Delivered
                                </SelectItem>
                                <SelectItem value="Partial">Partial</SelectItem>
                                <SelectItem value="Returned">
                                  Returned
                                </SelectItem>
                                <SelectItem value="Loading">
                                  Reschedule
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className="text-right">
                            <span className="font-bold font-mono text-sm">
                              {order.currentAmount.toLocaleString()}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            {diff !== 0 ? (
                              <span
                                className={`text-xs font-mono font-bold ${
                                  diff > 0 ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {diff > 0 ? "+" : ""}
                                {diff.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                -
                              </span>
                            )}
                          </TableCell>

                          <TableCell>
                            <Input
                              disabled={isCompleted}
                              placeholder="Note..."
                              value={state.notes || ""}
                              onChange={(e) =>
                                updateOrderState(
                                  order.id,
                                  "notes",
                                  e.target.value
                                )
                              }
                              className="w-full h-8 text-xs bg-white"
                            />
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isCompleted}
                              onClick={() => handleEditInvoice(order.invoiceId)}
                              className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                            >
                              <Edit3 className="w-4 h-4" />
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

      {/* Expense Dialog */}
      <ExpenseFormDialog
        open={isExpenseDialogOpen}
        onOpenChange={setIsExpenseDialogOpen}
        onSubmit={handleSubmitExpense}
        isLoadLocked={true} // ✅ LOCK THE LOAD ID
        initialData={
          {
            description: "",
            amount: 0,
            category: "Fuel",
            expenseDate: new Date().toISOString().split("T")[0],
            paymentMethod: "Cash",
            referenceNo: "",
            loadId: id, // ✅ PRE-FILL WITH CURRENT PAGE ID
          } as any
        }
      />
    </div>
  );
}
