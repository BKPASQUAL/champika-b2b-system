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
} from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  orderId: string;
  invoiceId: string | null;
  invoiceNo: string;
  customer: string;
  currentAmount: number; // This is the current amount in DB (Post-Edit)
  originalAmount: number; // This is the amount at Dispatch (Pre-Edit)
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

  // User State
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // State to track status/notes for each order
  const [reconcileData, setReconcileData] = useState<ReconcileState>({});

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Load User from LocalStorage
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("currentUser");
          if (stored) {
            setCurrentUser(JSON.parse(stored));
          }
        }

        // 2. Load Sheet Details
        const res = await fetch(`/api/orders/loading/history/${id}`);
        if (!res.ok) throw new Error("Failed to load data");
        const data = await res.json();

        setLoadDetails(data);

        // 3. Fetch Invoice Histories to find Original Amounts
        // This enables us to show the "Difference" even if the main record was updated.
        const ordersWithHistory = await Promise.all(
          data.orders.map(async (o: any) => {
            let originalAmount = o.totalAmount;

            // Try to find the oldest history record for this invoice
            if (o.invoiceId) {
              try {
                const histRes = await fetch(
                  `/api/invoices/${o.invoiceId}/history`
                );
                if (histRes.ok) {
                  const history = await histRes.json();
                  // If history exists, the oldest 'previousTotal' is likely our original dispatched amount
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
              currentAmount: o.totalAmount, // The value AFTER any edits
              originalAmount: originalAmount, // The value BEFORE edits
              status: o.status,
              paymentStatus: "Credit",
            };
          })
        );

        setOrders(ordersWithHistory);

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
        setReconcileData(initialState);
      } catch (error) {
        toast.error("Failed to load delivery sheet");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // --- Handlers ---
  const updateOrderState = (orderId: string, field: string, value: any) => {
    setReconcileData((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  const handleEditInvoice = (invoiceId: string | null) => {
    if (!invoiceId) {
      toast.error("Invoice not found for this order");
      return;
    }
    // Redirect to Edit page, keeping return URL
    router.push(
      `/dashboard/admin/invoices/${invoiceId}/edit?returnTo=/dashboard/admin/orders/loading/reconcile/${id}`
    );
  };

  const handleFinalize = async () => {
    if (!currentUser?.id) {
      toast.error("User session missing. Please login.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        loadId: id,
        userId: currentUser.id, // Send User ID
        updates: Object.entries(reconcileData).map(([orderId, data]) => ({
          orderId,
          ...data,
          // We send the current amount from the orders list, ensuring consistency
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

      toast.success("Delivery Load Reconciled Successfully!");
      router.push("/dashboard/admin/orders/loading/history");
    } catch (error) {
      toast.error("Failed to finalize reconciliation");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Stats ---
  const totalDispatchedValue = orders.reduce(
    (sum, order) => sum + order.originalAmount,
    0
  );
  const totalFinalValue = orders.reduce(
    (sum, order) => sum + order.currentAmount,
    0
  );
  const valueDifference = totalFinalValue - totalDispatchedValue;

  const deliveredCount = Object.values(reconcileData).filter(
    (d) => d.status === "Delivered" || d.status === "Partial"
  ).length;

  // Helper for Diff Styling
  const getDiffStyles = (diff: number) => {
    if (diff > 0) return "text-green-600 bg-green-50";
    if (diff < 0) return "text-red-600 bg-red-50";
    return "text-muted-foreground bg-gray-50";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              {currentUser && (
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-100">
                  <User className="w-3 h-3" />
                  Reconciling as: {currentUser.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          size="lg"
          className="bg-black hover:bg-gray-800 text-white shadow-md"
          onClick={handleFinalize}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          Finalize & Close Load
        </Button>
      </div>

      {/* Summary Stats */}
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
              {valueDifference !== 0 &&
                (valueDifference > 0 ? (
                  <ArrowUpRight className="w-6 h-6 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-6 h-6 text-red-600" />
                ))}
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Reconcile Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order List</CardTitle>
          <CardDescription>
            Verify status and amounts. Use "Edit Invoice" to correct any
            discrepancies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[120px]">Order ID</TableHead>
                  <TableHead className="w-[200px]">Customer</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="text-right">Original (Sent)</TableHead>
                  <TableHead className="text-right">Final (Edit)</TableHead>
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

                      {/* Original Amount (Sent) */}
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {order.originalAmount.toLocaleString()}
                      </TableCell>

                      {/* Final Amount (Current DB Value) - READ ONLY */}
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          {order.currentAmount !== order.originalAmount && (
                            <Edit3 className="w-3 h-3 text-blue-500 animate-pulse" />
                          )}
                          <span className="font-bold font-mono text-sm">
                            {order.currentAmount.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>

                      {/* Difference */}
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={`font-mono ${getDiffStyles(diff)}`}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff.toLocaleString()}
                        </Badge>
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="pl-6">
                        <Input
                          placeholder="Reason for change..."
                          value={state.notes || ""}
                          onChange={(e) =>
                            updateOrderState(order.id, "notes", e.target.value)
                          }
                          className="w-full h-8 text-xs bg-white"
                        />
                      </TableCell>

                      {/* Edit Action */}
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleEditInvoice(order.invoiceId)
                                }
                                className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                                Edit Invoice
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Change quantity/prices if rejected/returned</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
