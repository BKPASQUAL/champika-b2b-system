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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Edit3,
  CreditCard,
  Package,
  AlertCircle,
  DollarSign,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // State to track status/notes
  const [reconcileData, setReconcileData] = useState<ReconcileState>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Load User
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("currentUser");
          if (stored) {
            try {
              const parsedUser = JSON.parse(stored);
              // Validate user object has ID
              if (parsedUser && parsedUser.id) {
                setCurrentUser(parsedUser);
              } else {
                console.warn("Invalid user session found");
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

        // 3. Fetch History for Differences
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

        // Initialize Reconcile State
        const initialState: ReconcileState = {};
        ordersWithHistory.forEach((o: OrderItem) => {
          initialState[o.id] = {
            // Default to 'Delivered' if it's currently 'In Transit' or 'Loading'
            status:
              o.status === "In Transit" || o.status === "Loading"
                ? "Delivered"
                : o.status,
            paymentStatus: "Credit",
            notes: "",
          };
        });
        setReconcileData(initialState);
      } catch (error) {
        toast.error("Failed to load delivery sheet");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const updateOrderState = (orderId: string, field: string, value: any) => {
    // Prevent editing if load is completed
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

  // Stats
  const totalDispatchedValue = orders.reduce(
    (sum, order) => sum + order.originalAmount,
    0
  );
  const totalFinalValue = orders.reduce(
    (sum, order) => sum + order.currentAmount,
    0
  );
  const valueDifference = totalFinalValue - totalDispatchedValue;

  return (
    <div className="space-y-6 pb-10">
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Original Dispatched Value</CardDescription>
            <CardTitle className="text-2xl font-mono text-muted-foreground">
              LKR {totalDispatchedValue.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Final Reconciled Value</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-700">
              LKR {totalFinalValue.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          className={
            valueDifference < 0
              ? "bg-red-50 border-red-100"
              : valueDifference > 0
              ? "bg-green-50 border-green-100"
              : ""
          }
        >
          <CardHeader className="pb-2">
            <CardDescription>Total Difference</CardDescription>
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-2xl font-bold ${
                  valueDifference < 0
                    ? "text-red-700"
                    : valueDifference > 0
                    ? "text-green-700"
                    : "text-slate-700"
                }`}
              >
                {valueDifference > 0 ? "+" : ""}
                LKR {valueDifference.toLocaleString()}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Reconciliation</CardTitle>
          <CardDescription>
            {isCompleted
              ? "This load has been completed. Records are read-only."
              : "Verify status and amounts. Use 'Edit Invoice' to correct any discrepancies."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[120px]">Order ID</TableHead>
                  <TableHead className="w-[200px]">Customer</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="text-right">Sent Amount</TableHead>
                  <TableHead className="text-right">Final Amount</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                  <TableHead className="w-[200px] pl-6">Notes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const state = reconcileData[order.id] || {};
                  const diff = order.currentAmount - order.originalAmount;

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.orderId}
                        <div className="text-xs text-muted-foreground font-mono">
                          {order.invoiceNo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">
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
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Delivered">Delivered</SelectItem>
                            <SelectItem value="Partial">Partial</SelectItem>
                            <SelectItem value="Returned">Returned</SelectItem>
                            <SelectItem value="Loading">Reschedule</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="text-right font-mono text-muted-foreground">
                        {order.originalAmount.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="font-bold font-mono text-sm">
                          {order.currentAmount.toLocaleString()}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        {diff !== 0 && (
                          <Badge
                            variant="outline"
                            className={`font-mono ${
                              diff > 0
                                ? "text-green-600 bg-green-50"
                                : "text-red-600 bg-red-50"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toLocaleString()}
                          </Badge>
                        )}
                        {diff === 0 && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="pl-6">
                        <Input
                          disabled={isCompleted}
                          placeholder="Note..."
                          value={state.notes || ""}
                          onChange={(e) =>
                            updateOrderState(order.id, "notes", e.target.value)
                          }
                          className="w-full h-8 text-xs bg-white"
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isCompleted}
                          onClick={() => handleEditInvoice(order.invoiceId)}
                          className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                          Edit
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
  );
}
