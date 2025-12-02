// FILE PATH: app/dashboard/admin/orders/loading/reconcile/[id]/page.tsx
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
import { ArrowLeft, Loader2, CheckCircle2, Edit3 } from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  orderId: string;
  invoiceId: string | null;
  invoiceNo: string;
  customer: string;
  originalAmount: number;
  status: string;
  paymentStatus: string;
}

interface ReconcileState {
  [orderId: string]: {
    status: string;
    finalAmount: number;
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

  // State to track changes for each order
  const [reconcileData, setReconcileData] = useState<ReconcileState>({});

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/loading/history/${id}`);
        if (!res.ok) throw new Error("Failed to load data");
        const data = await res.json();

        setLoadDetails(data);

        const mappedOrders = data.orders.map((o: any) => ({
          id: o.id,
          orderId: o.orderId,
          invoiceId: o.invoiceId,
          invoiceNo: o.invoiceNo || "N/A",
          customer: o.customer.shopName,
          originalAmount: o.totalAmount,
          status: o.status,
          paymentStatus: "Unpaid",
        }));

        setOrders(mappedOrders);

        const initialState: ReconcileState = {};
        mappedOrders.forEach((o: OrderItem) => {
          initialState[o.id] = {
            status: "Delivered",
            finalAmount: o.originalAmount,
            paymentStatus: "Paid",
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

  // ✅ UPDATED: Navigate to invoice edit page with return URL
  const handleEditInvoice = (invoiceId: string | null) => {
    if (!invoiceId) {
      toast.error("Invoice not found for this order");
      return;
    }

    // Navigate to invoice edit page with return URL
    // This allows the invoice page to show "Back to Reconciliation" button
    router.push(
      `/dashboard/admin/invoices/${invoiceId}/edit?returnTo=/dashboard/admin/orders/loading/reconcile/${id}`
    );
  };

  const handleFinalize = async () => {
    setSubmitting(true);
    try {
      const payload = {
        loadId: id,
        updates: Object.entries(reconcileData).map(([orderId, data]) => ({
          orderId,
          ...data,
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

  // --- Calculated Stats ---
  const deliveredCount = Object.values(reconcileData).filter(
    (d) => d.status === "Delivered"
  ).length;
  const rescheduledCount = Object.values(reconcileData).filter(
    (d) => d.status === "Loading"
  ).length;
  const totalCashCollected = Object.entries(reconcileData).reduce(
    (sum, [orderId, data]) => {
      if (data.paymentStatus === "Paid") {
        return sum + data.finalAmount;
      }
      return sum;
    },
    0
  );

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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Reconcile Delivery
          </h1>
          <p className="text-muted-foreground mt-1">
            {loadDetails?.loadId} • {loadDetails?.lorryNumber}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-3">
            <CardDescription className="text-green-700 font-medium">
              Cash to Collect
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              {totalCashCollected.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="font-medium">
              Status Overview
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Delivered</span>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                {deliveredCount}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rescheduled</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {rescheduledCount}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="flex items-center justify-center border-2 border-dashed">
          <Button
            size="lg"
            className="w-full m-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
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
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Reconciliation</CardTitle>
          <CardDescription>
            Mark status, edit amounts, or reschedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Order ID</TableHead>
                  <TableHead className="w-[180px]">Invoice No</TableHead>
                  <TableHead className="w-[180px]">Customer</TableHead>
                  <TableHead className="w-[140px]">Action / Status</TableHead>
                  <TableHead className="w-[130px]">Payment</TableHead>
                  <TableHead className="w-[150px]">Final Bill Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const state = reconcileData[order.id] || {};
                  const isDelivered =
                    state.status === "Delivered" || state.status === "Partial";
                  const isRescheduled = state.status === "Loading";

                  return (
                    <TableRow
                      key={order.id}
                      className={
                        isRescheduled
                          ? "bg-blue-50/30"
                          : !isDelivered
                          ? "bg-red-50/20"
                          : ""
                      }
                    >
                      {/* Order ID */}
                      <TableCell className="font-medium font-mono text-sm">
                        {order.orderId}
                      </TableCell>

                      {/* Invoice Number with Edit Button */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {order.invoiceNo}
                          </Badge>
                          {order.invoiceId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditInvoice(order.invoiceId)}
                              title="Edit Invoice"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      {/* Customer */}
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{order.customer}</div>
                          <div className="text-xs text-muted-foreground">
                            Bill: LKR {order.originalAmount.toLocaleString()}
                          </div>
                        </div>
                      </TableCell>

                      {/* Status Dropdown */}
                      <TableCell>
                        <Select
                          value={state.status}
                          onValueChange={(value) =>
                            updateOrderState(order.id, "status", value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Delivered">Delivered</SelectItem>
                            <SelectItem value="Partial">
                              Partial Delivery
                            </SelectItem>
                            <SelectItem value="Loading">Reschedule</SelectItem>
                            <SelectItem value="Returned">Returned</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Payment Status */}
                      <TableCell>
                        <Select
                          value={state.paymentStatus}
                          onValueChange={(value) =>
                            updateOrderState(order.id, "paymentStatus", value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Paid">Paid (Cash)</SelectItem>
                            <SelectItem value="Unpaid">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Final Amount Input */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Rs
                          </span>
                          <Input
                            type="number"
                            value={state.finalAmount}
                            onChange={(e) =>
                              updateOrderState(
                                order.id,
                                "finalAmount",
                                Number(e.target.value)
                              )
                            }
                            className="w-28"
                          />
                        </div>
                      </TableCell>

                      {/* Notes */}
                      <TableCell>
                        <Input
                          placeholder="Optional notes..."
                          value={state.notes}
                          onChange={(e) =>
                            updateOrderState(order.id, "notes", e.target.value)
                          }
                          className="w-full"
                        />
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
