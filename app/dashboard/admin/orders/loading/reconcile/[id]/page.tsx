"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Undo2,
  DollarSign,
  CalendarClock,
  FileEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
// IMPORT ADDED HERE
import { cn } from "@/lib/utils";

// --- Types ---
interface OrderItem {
  id: string;
  orderId: string;
  invoiceId?: string;
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
          invoiceId: o.id, // Ideally mapped to actual Invoice ID if available
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

  const handleEditBill = (invoiceId: string) => {
    // Open in new tab to not lose current reconciliation state
    window.open(`/dashboard/admin/invoices/${invoiceId}/edit`, "_blank");
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
      router.push(`/dashboard/admin/orders/loading/history/${id}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save reconciliation");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Calculations ---
  const totalCollected = Object.values(reconcileData).reduce(
    (sum, item) =>
      sum +
      (item.status === "Delivered" || item.status === "Partial"
        ? Number(item.finalAmount)
        : 0),
    0
  );

  const deliveredCount = Object.values(reconcileData).filter(
    (i) => i.status === "Delivered"
  ).length;
  const rescheduleCount = Object.values(reconcileData).filter(
    (i) => i.status === "Loading"
  ).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reconcile Delivery
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <Badge variant="outline" className="font-mono">
              {loadDetails?.loadId}
            </Badge>
            <span>•</span>
            <span>{loadDetails?.lorryNumber}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              Cash to Collect
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              {totalCollected.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 text-sm">
            <div>
              <div className="text-2xl font-bold">{deliveredCount}</div>
              <p className="text-muted-foreground">Delivered</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {rescheduleCount}
              </div>
              <p className="text-muted-foreground">Rescheduled</p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-center items-start p-6 bg-slate-50">
          <Button
            size="lg"
            className="w-full bg-black hover:bg-gray-800 text-white"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Order Details</TableHead>
                <TableHead className="w-[180px]">Action / Status</TableHead>
                <TableHead className="w-[160px]">Payment</TableHead>
                <TableHead className="w-[160px]">Final Bill Amount</TableHead>
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
                        ? "bg-red-50/30"
                        : ""
                    }
                  >
                    {/* Order Info with Edit Button */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">
                          {order.customer}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="w-fit font-mono text-[10px]"
                          >
                            {order.orderId}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Bill: LKR {order.originalAmount.toLocaleString()}
                          </span>

                          {/* EDIT BILL BUTTON */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100 ml-2"
                            onClick={() => handleEditBill(order.id)}
                            title="Edit Full Bill"
                          >
                            <FileEdit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Selector */}
                    <TableCell>
                      <Select
                        value={state.status}
                        onValueChange={(val) =>
                          updateOrderState(order.id, "status", val)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            state.status === "Delivered" &&
                              "bg-green-100 text-green-700 border-green-200",
                            state.status === "Loading" &&
                              "bg-blue-100 text-blue-700 border-blue-200",
                            state.status === "Returned" &&
                              "bg-red-100 text-red-700 border-red-200"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Delivered">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />{" "}
                              Delivered
                            </div>
                          </SelectItem>

                          {/* Reschedule Option */}
                          <SelectItem value="Loading">
                            <div className="flex items-center gap-2">
                              <CalendarClock className="w-4 h-4 text-blue-600" />{" "}
                              Reschedule (Next Load)
                            </div>
                          </SelectItem>

                          <SelectItem value="Partial">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-orange-600" />{" "}
                              Partial / Changed
                            </div>
                          </SelectItem>
                          <SelectItem value="Returned">
                            <div className="flex items-center gap-2">
                              <Undo2 className="w-4 h-4 text-red-600" />{" "}
                              Returned
                            </div>
                          </SelectItem>
                          <SelectItem value="Cancelled">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-gray-600" />{" "}
                              Cancelled
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Payment Status */}
                    <TableCell>
                      <Select
                        value={state.paymentStatus}
                        onValueChange={(val) =>
                          updateOrderState(order.id, "paymentStatus", val)
                        }
                        disabled={!isDelivered}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Paid">Paid (Cash)</SelectItem>
                          <SelectItem value="Credit">
                            Credit / Unpaid
                          </SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Amount Input */}
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                          Rs
                        </span>
                        <Input
                          type="number"
                          className={cn(
                            "pl-8 font-semibold h-9",
                            state.finalAmount !== order.originalAmount &&
                              "border-orange-300 text-orange-700 bg-orange-50"
                          )}
                          value={state.finalAmount}
                          onChange={(e) =>
                            updateOrderState(
                              order.id,
                              "finalAmount",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={!isDelivered}
                        />
                      </div>
                    </TableCell>

                    {/* Notes */}
                    <TableCell>
                      <Input
                        placeholder={
                          isRescheduled
                            ? "Reason for reschedule..."
                            : "Notes..."
                        }
                        value={state.notes}
                        onChange={(e) =>
                          updateOrderState(order.id, "notes", e.target.value)
                        }
                        className="text-xs h-9"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
