"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  User,
  Loader2,
  Phone,
  CheckCircle2,
  Clock,
  Package,
  CreditCard,
  Building2,
  Banknote,
  AlertCircle,
  Truck,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
interface PurchaseItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  discount: number;
  totalCost: number;
  freeQuantity?: number;
}

interface PurchaseDetail {
  id: string;
  purchaseId: string;
  invoiceNo?: string;
  purchaseDate: string;
  arrivalDate?: string;
  status: "Ordered" | "Received" | "Cancelled";
  paymentStatus: "Paid" | "Unpaid" | "Partial";
  totalAmount: number;
  paidAmount: number;
  notes?: string;
  supplier: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  business?: {
    name: string;
  };
  items: PurchaseItem[];
  payments?: any[];
}

export default function WiremanViewBillPage({
  params,
}: {
  params: { id: string };
}) {
  // FIX: Access ID directly, removed use() hook
  const { id } = params;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<PurchaseDetail | null>(null);

  useEffect(() => {
    // Prevent this page from trying to load "create-free" as an ID
    if (id === "create-free") return;

    const fetchBill = async () => {
      try {
        const res = await fetch(`/api/purchases/${id}`);
        if (!res.ok) throw new Error("Failed to load bill");
        const data = await res.json();

        setBill({
          ...data,
          supplier: data.supplier || { name: data.supplierName },
          items: data.items || [],
        });
      } catch (error) {
        toast.error("Error loading bill details");
        router.push("/dashboard/office/wireman/purchases");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchBill();
    }
  }, [id, router]);

  const getInitials = (name: string) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const renderStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Ordered: "bg-blue-50 text-blue-700 border-blue-200",
      Received: "bg-green-50 text-green-700 border-green-200",
      Cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    const icons: Record<string, any> = {
      Ordered: Clock,
      Received: CheckCircle2,
      Cancelled: AlertCircle,
    };
    const Icon = icons[status] || FileText;

    return (
      <Badge
        variant="outline"
        className={`px-3 py-1 gap-1.5 ${styles[status] || "bg-gray-50"}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  };

  if (id === "create-free") return null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!bill) return null;

  const balanceDue = bill.totalAmount - bill.paidAmount;
  const totalItemsQty = bill.items.reduce(
    (acc, item) => acc + item.quantity,
    0,
  );
  const totalFreeQty = bill.items.reduce(
    (acc, item) => acc + (item.freeQuantity || 0),
    0,
  );
  const paymentsList = bill.payments || [];

  return (
    <div className="bg-muted/40 min-h-screen pb-10">
      <div className="mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-background hover:bg-red-50"
                onClick={() =>
                  router.push("/dashboard/office/wireman/purchases")
                }
              >
                <ArrowLeft className="w-4 h-4 text-red-900" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Bill {bill.purchaseId}
              </h1>
              {renderStatusBadge(bill.status)}
            </div>
            <div className="flex flex-col ml-11 gap-1">
              <p className="text-sm text-muted-foreground">
                Issued on {new Date(bill.purchaseDate).toLocaleDateString()}
              </p>
              {bill.invoiceNo && (
                <span className="text-xs font-mono bg-red-100 text-red-800 px-2 py-0.5 rounded w-fit border border-red-200">
                  Vendor Ref: {bill.invoiceNo}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Vendor / Supplier
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border bg-blue-50 text-blue-600">
                    <AvatarFallback>
                      {getInitials(bill.supplier.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {bill.supplier.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {bill.supplier.contactPerson}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bill.supplier.phone}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-l-4 border-l-red-500">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-red-600">
                    Bill To
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start gap-4">
                  <Avatar className="h-10 w-10 border bg-red-50 text-red-600">
                    <AvatarFallback>
                      <Building2 className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base leading-none">
                      {bill.business?.name || "Wireman Agency"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Authorized Purchase
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-4">
                <CardTitle className="text-lg font-semibold">
                  Purchase Items
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Product Details</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-center">Free</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right pr-6">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bill.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-6">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.freeQuantity || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.unitCost.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {item.totalCost.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-slate-50/50">
                    <TableRow>
                      <TableCell className="pl-6 font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {totalItemsQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {totalFreeQty}
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className="text-right pr-6 font-bold text-red-700"
                      >
                        LKR {bill.totalAmount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm border-t-4 border-t-red-600">
              <CardHeader className="bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-red-600" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    LKR {bill.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span className="flex items-center gap-1">
                    <Banknote className="w-3 h-3" /> Paid
                  </span>
                  <span className="font-medium">
                    - LKR {bill.paidAmount.toLocaleString()}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-end">
                  <span className="font-bold">Balance Due</span>
                  <span
                    className={cn(
                      "font-bold text-xl",
                      balanceDue > 0 ? "text-red-600" : "text-emerald-600",
                    )}
                  >
                    LKR {Math.max(0, balanceDue).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
