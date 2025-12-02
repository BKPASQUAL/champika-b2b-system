"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  FileText,
  Calendar,
  User,
  MapPin,
  TruckIcon,
  History,
  Edit,
  Loader2,
  Phone,
  Store,
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input"; // Used for look only, disabled
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { printInvoice } from "../print-utils";
import { toast } from "sonner";

// --- Interfaces ---
interface InvoiceHistory {
  id: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  previousTotal: number;
}

export default function ViewInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);

  // History State
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<InvoiceHistory[]>([]);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) throw new Error("Failed to load invoice");
        const data = await res.json();
        setInvoice(data);
      } catch (error) {
        toast.error("Error loading invoice details");
        router.push("/dashboard/admin/invoices");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id, router]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderOrderStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      Processing: "bg-blue-100 text-blue-800 border-blue-200",
      Loading: "bg-indigo-100 text-indigo-800 border-indigo-200",
      "In Transit": "bg-indigo-100 text-indigo-800 border-indigo-200",
      Delivered: "bg-green-100 text-green-800 border-green-200",
      Cancelled: "bg-red-100 text-red-800 border-red-200",
    };
    return (
      <Badge
        variant="outline"
        className={`${styles[status] || "bg-gray-100"} border`}
      >
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className=" mx-auto space-y-6 pb-10">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">View Invoice</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-muted-foreground">
                {invoice.invoiceNo}
              </span>
              {renderOrderStatusBadge(invoice.orderStatus || "Pending")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* History Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" onClick={fetchHistory}>
                <History className="w-4 h-4 mr-2" /> History
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Invoice History</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {historyLoading ? (
                  <div className="flex justify-center">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : historyLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No history records found.
                  </p>
                ) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {historyLogs.map((log) => (
                      <div
                        key={log.id}
                        className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-blue-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="w-full p-4 rounded border border-slate-200 bg-slate-50 shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-900 text-sm">
                              {log.changedBy}
                            </span>
                            <time className="font-caveat font-medium text-xs text-indigo-500">
                              {new Date(log.changedAt).toLocaleString()}
                            </time>
                          </div>
                          <p className="text-slate-500 text-xs">
                            Reason: {log.reason}
                          </p>
                          <div className="mt-2 text-xs font-mono bg-white p-1 rounded border">
                            Prev Total: LKR {log.previousTotal.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="outline" onClick={() => printInvoice(id)}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>

          <Button
            onClick={() => router.push(`/dashboard/admin/invoices/${id}/edit`)}
          >
            <Edit className="w-4 h-4 mr-2" /> Edit Invoice
          </Button>
        </div>
      </div>

      {/* Main Grid Layout - Matching Edit Page Structure */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN (Details & Items) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Customer and sales information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Section */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Customer
                  </Label>
                  <div className="flex items-start gap-3 p-3 border rounded-md bg-slate-50">
                    <Store className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">
                        {invoice.customer?.shop}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.customer?.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" /> {invoice.customer?.phone}
                      </div>
                      <div className="flex items-start gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 mt-0.5" />{" "}
                        {invoice.customer?.address}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sales Rep Section */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Sales Representative
                  </Label>
                  <div className="flex items-center gap-3 p-3 border rounded-md bg-slate-50 h-full">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{invoice.salesRep}</p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        Representative
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Invoice Date</Label>
                  <div className="flex items-center gap-2 p-2 border rounded bg-slate-50 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />{" "}
                    {invoice.date}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">
                    Invoice Number
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded bg-slate-50 text-sm font-mono">
                    <FileText className="w-4 h-4 text-muted-foreground" />{" "}
                    {invoice.invoiceNo}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Purchased Items</CardTitle>
              <CardDescription>
                {invoice.items.length} items in this invoice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center w-20">Qty</TableHead>
                    <TableHead className="text-center w-20">Free</TableHead>
                    <TableHead className="text-right w-28">
                      Unit Price
                    </TableHead>
                    <TableHead className="text-right w-32">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.sku}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity}{" "}
                        <span className="text-xs text-muted-foreground">
                          {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.freeQuantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (Summary) */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  LKR {invoice.grandTotal.toFixed(2)}
                </span>
              </div>

              {/* Assuming discount logic maps similarly */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Extra Discount</span>
                <span className="text-green-600">- LKR 0.00</span>
              </div>

              <Separator />

              <div className="flex justify-between items-end">
                <span className="font-bold text-lg">Grand Total</span>
                <div className="text-right">
                  <span className="block font-bold text-2xl text-primary">
                    LKR{" "}
                    {invoice.grandTotal.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Including taxes
                  </span>
                </div>
              </div>

              {invoice.notes && (
                <div className="mt-6 p-3 bg-yellow-50 border border-yellow-100 rounded text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Notes:</p>
                  {invoice.notes}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
