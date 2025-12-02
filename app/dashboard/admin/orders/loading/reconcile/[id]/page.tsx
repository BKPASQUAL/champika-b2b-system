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
} from "lucide-react";
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
          paymentStatus: "Credit",
        }));

        setOrders(mappedOrders);

        const initialState: ReconcileState = {};
        mappedOrders.forEach((o: OrderItem) => {
          initialState[o.id] = {
            status: "Delivered",
            finalAmount: o.originalAmount,
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
    (d) => d.status === "Delivered" || d.status === "Partial"
  ).length;

  const rescheduledCount = Object.values(reconcileData).filter(
    (d) => d.status === "Loading"
  ).length;

  const returnedCount = Object.values(reconcileData).filter(
    (d) => d.status === "Returned"
  ).length;

  const totalBillValue = orders.reduce(
    (sum, order) => sum + order.originalAmount,
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
      {/* Header with Better Spacing */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Reconcile Delivery
            </h1>
            <p className="text-muted-foreground mt-1">
              {loadDetails?.loadId} • {loadDetails?.lorryNumber} •{" "}
              {loadDetails?.driverName}
            </p>
          </div>
        </div>

        {/* Finalize Button in Header */}
        <Button
          size="lg"
          className="bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white shadow-lg"
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

      {/* Summary Cards - Simplified to 2 Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total Bill Value */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-blue-700 font-medium">
                Total Bill Value
              </CardDescription>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
              Rs. {totalBillValue.toLocaleString()}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Status Overview */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="font-medium">
                Delivery Status
              </CardDescription>
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Delivered</span>
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200"
              >
                {deliveredCount}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rescheduled</span>
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                {rescheduledCount}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Returned</span>
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200"
              >
                {returnedCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Reconciliation</CardTitle>
          <CardDescription>
            Mark delivery status and adjust final bill amounts if needed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Order ID</TableHead>
                  <TableHead className="w-[140px]">Invoice No</TableHead>
                  <TableHead className="w-[200px]">Customer</TableHead>
                  <TableHead className="w-[140px]">Delivery Status</TableHead>
                  <TableHead className="w-[130px]">Payment</TableHead>
                  <TableHead className="w-[160px]">
                    <div className="flex items-center gap-2">
                      Final Bill Amount
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[200px]">
                              Edit here for partial delivery adjustments
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableHead>
                  <TableHead className="w-[200px]">Notes</TableHead>
                  <TableHead className="w-[100px] text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const state = reconcileData[order.id] || {};
                  const isDelivered =
                    state.status === "Delivered" || state.status === "Partial";
                  const isRescheduled = state.status === "Loading";
                  const isReturned = state.status === "Returned";

                  return (
                    <TableRow
                      key={order.id}
                      className={
                        isRescheduled
                          ? "bg-blue-50/30"
                          : isReturned
                          ? "bg-red-50/30"
                          : !isDelivered
                          ? "bg-yellow-50/20"
                          : "bg-green-50/20"
                      }
                    >
                      <TableCell className="font-medium">
                        {order.orderId}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {order.invoiceNo}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {order.customer}
                      </TableCell>

                      <TableCell>
                        <Select
                          value={state.status || "Delivered"}
                          onValueChange={(val) =>
                            updateOrderState(order.id, "status", val)
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Delivered">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Delivered
                              </div>
                            </SelectItem>
                            <SelectItem value="Partial">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                Partial
                              </div>
                            </SelectItem>
                            <SelectItem value="Loading">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                Reschedule
                              </div>
                            </SelectItem>
                            <SelectItem value="Returned">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                Returned
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-orange-50 text-orange-700 border-orange-200 font-medium"
                        >
                          <CreditCard className="w-3 h-3 mr-1" />
                          Credit
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Rs.
                          </span>
                          <Input
                            type="number"
                            value={state.finalAmount || order.originalAmount}
                            onChange={(e) =>
                              updateOrderState(
                                order.id,
                                "finalAmount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-[110px] h-9 font-medium"
                            disabled
                          />
                        </div>
                        {state.finalAmount !== order.originalAmount && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Original: Rs.{" "}
                            {order.originalAmount.toLocaleString()}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <Input
                          placeholder="Add notes..."
                          value={state.notes || ""}
                          onChange={(e) =>
                            updateOrderState(order.id, "notes", e.target.value)
                          }
                          className="w-[180px] h-9 text-sm"
                        />
                      </TableCell>

                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleEditInvoice(order.invoiceId)
                                }
                                className="w-full"
                              >
                                <Edit3 className="w-3.5 h-3.5 mr-1" />
                                Edit
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Edit full invoice (items, prices, quantities)
                              </p>
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
