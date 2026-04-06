"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Truck,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Invoice {
  id: string;
  invoiceNo: string;
  manualInvoiceNo?: string;
  orderId: string;
  date: string;
  customerId: string;
  customerName: string;
  salesRepName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  orderStatus: string;
  dueDate: string;
  createdAt: string;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Paid: "bg-green-100 text-green-800",
  Unpaid: "bg-red-100 text-red-800",
  Partial: "bg-yellow-100 text-yellow-800",
  Overdue: "bg-orange-100 text-orange-800",
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Processing: "bg-blue-100 text-blue-700",
  Checking: "bg-purple-100 text-purple-700",
  Loading: "bg-orange-100 text-orange-700",
  "In Transit": "bg-indigo-100 text-indigo-700",
  Delivered: "bg-green-100 text-green-700",
  Completed: "bg-teal-100 text-teal-700",
  Cancelled: "bg-red-100 text-red-700",
};

function DueDateCell({ billingDate }: { billingDate: string }) {
  if (!billingDate) return <span className="text-muted-foreground text-xs">-</span>;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const billed = new Date(billingDate); billed.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - billed.getTime()) / 86400000);

  if (diff === 0) return <span className="text-xs font-medium text-blue-600">Today</span>;
  if (diff === 1) return <span className="text-xs font-medium text-blue-500">1d</span>;
  return <span className="text-xs font-medium text-blue-500">{diff}d</span>;
}

export default function RepMyInvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchInvoices = async () => {
      let userId = "";
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
          userId = JSON.parse(storedUser).id;
        }
      }

      if (!userId) {
        toast.error("User not found. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/invoices?repId=${userId}`);
        if (!res.ok) throw new Error("Failed to fetch invoices");
        const data = await res.json();
        setInvoices(data);
      } catch (error) {
        console.error(error);
        toast.error("Error loading invoices");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        search === "" ||
        inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
        (inv.manualInvoiceNo ?? "").toLowerCase().includes(search.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || inv.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const total = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const paid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const due = invoices.reduce((s, i) => s + (i.dueAmount || 0), 0);
    const overdueCount = invoices.filter((i) => {
      if (i.status === "Paid") return false;
      if (!i.dueDate) return false;
      return new Date(i.dueDate) < new Date();
    }).length;
    return { total, paid, due, overdueCount };
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>
        <p className="text-muted-foreground">All invoices created by you</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
            <Receipt className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              LKR {stats.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{invoices.length} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              LKR {stats.paid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Payments received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              LKR {stats.due.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Yet to collect</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice no or customer..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due Amt</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">
                        <div className="font-semibold">{inv.manualInvoiceNo || inv.invoiceNo}</div>
                        {inv.manualInvoiceNo && (
                          <div className="text-[10px] text-muted-foreground">{inv.invoiceNo}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(inv.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {inv.customerName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${DELIVERY_STATUS_COLORS[inv.orderStatus] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          <Truck className="w-3 h-3 mr-1" />
                          {inv.orderStatus || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {(inv.totalAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600 text-sm">
                        {(inv.paidAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600 text-sm font-medium">
                        {(inv.dueAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${PAYMENT_STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-800"}`}
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DueDateCell billingDate={inv.date} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => router.push(`/dashboard/rep/invoices/${inv.id}`)}
                        >
                          <Eye className="w-3 h-3" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
