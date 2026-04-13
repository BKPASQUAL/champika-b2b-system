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
import { TablePagination } from "@/components/ui/TablePagination";

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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">My Invoices</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">All invoices created by you</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Billed</CardTitle>
            <Receipt className="h-4 w-4 text-blue-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold text-blue-600 truncate">
              LKR {stats.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{invoices.length} invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Collected</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold text-green-600 truncate">
              LKR {stats.paid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Payments received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold text-yellow-600 truncate">
              LKR {stats.due.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Yet to collect</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="text-base sm:text-2xl font-bold text-red-600">
              {stats.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">Invoice List</CardTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice or customer..."
                className="pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-sm">
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

          {/* ── Mobile & Tablet card list (hidden on lg+) ── */}
          <div className="lg:hidden space-y-3">
            {loading ? (
              <div className="flex justify-center items-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Receipt className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No invoices found</p>
                <p className="text-xs mt-1">Try adjusting your search or filter</p>
              </div>
            ) : (
              paginated.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => router.push(`/dashboard/rep/invoices/${inv.id}`)}
                  className="w-full text-left rounded-xl border bg-card hover:bg-muted/40 active:scale-[0.99] transition-all duration-150 p-4 space-y-3 shadow-sm"
                >
                  {/* Row 1: invoice no + payment badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm font-mono leading-tight">
                        {inv.manualInvoiceNo || inv.invoiceNo}
                      </p>
                      {inv.manualInvoiceNo && (
                        <p className="text-[10px] text-muted-foreground font-mono">{inv.invoiceNo}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-800"}`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: customer + date */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{inv.customerName}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Calendar className="w-3 h-3" />
                      {new Date(inv.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  {/* Row 3: amounts */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                      <p className="text-sm font-bold mt-0.5">
                        {(inv.totalAmount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center border-x">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid</p>
                      <p className="text-sm font-bold text-green-600 mt-0.5">
                        {(inv.paidAmount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Due</p>
                      <p className={`text-sm font-bold mt-0.5 ${inv.dueAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                        {(inv.dueAmount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Row 4: delivery badge + age */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${DELIVERY_STATUS_COLORS[inv.orderStatus] ?? "bg-gray-100 text-gray-700"}`}>
                      <Truck className="w-3 h-3" />
                      {inv.orderStatus || "—"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <DueDateCell billingDate={inv.date} />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* ── Desktop table (lg+) ── */}
          <div className="hidden lg:block rounded-md border overflow-x-auto">
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
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16">
                      <div className="flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => router.push(`/dashboard/rep/invoices/${inv.id}`)}>
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
                      <TableCell className="font-medium text-sm">{inv.customerName}</TableCell>
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
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/rep/invoices/${inv.id}`); }}
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

          {/* Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />

        </CardContent>
      </Card>
    </div>
  );
}
