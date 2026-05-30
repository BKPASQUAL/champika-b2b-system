"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useCachedFetch, invalidatePaymentCaches, invalidateFinanceCaches } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { Invoice, SortField, SortOrder } from "./types";
import { InvoiceTable } from "./_components/InvoiceTable";
import { InvoiceStats } from "./_components/InvoiceStats";

const STORAGE_KEYS = {
  search: "admin_invoices_search",
  status: "admin_invoices_status",
  rep: "admin_invoices_rep",
  sortField: "admin_invoices_sortField",
  sortOrder: "admin_invoices_sortOrder",
  page: "admin_invoices_page",
};

const getStoredValue = (key: string, defaultValue: string) => {
  if (typeof window !== "undefined") {
    const [navigation] = performance.getEntriesByType("navigation");
    if (navigation && (navigation as PerformanceNavigationTiming).type === "reload") {
      sessionStorage.removeItem(key);
      return defaultValue;
    }
    return sessionStorage.getItem(key) || defaultValue;
  }
  return defaultValue;
};

export default function InvoicesPage() {
  const router = useRouter();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState(() => getStoredValue(STORAGE_KEYS.search, ""));
  const [statusFilter, setStatusFilter] = useState(() => getStoredValue(STORAGE_KEYS.status, "all"));
  const [repFilter, setRepFilter] = useState(() => getStoredValue(STORAGE_KEYS.rep, "all"));

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>(() => getStoredValue(STORAGE_KEYS.sortField, "createdAt") as SortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => getStoredValue(STORAGE_KEYS.sortOrder, "desc") as SortOrder);
  const [currentPage, setCurrentPage] = useState(() => {
    const val = getStoredValue(STORAGE_KEYS.page, "1");
    return parseInt(val, 10) || 1;
  });
  const itemsPerPage = 10;

  const {
    data: rawInvoices = [],
    loading,
    refetch: fetchInvoices,
  } = useCachedFetch<any[]>("/api/invoices", [], () =>
    toast.error("Failed to load invoices")
  );

  const { data: allUsers = [] } = useCachedFetch<any[]>("/api/users", []);

  const invoices: Invoice[] = useMemo(
    () =>
      rawInvoices.map((inv: any) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        date:
          inv.date ||
          (inv.createdAt
            ? inv.createdAt.split("T")[0]
            : new Date().toISOString().split("T")[0]),
        createdAt: inv.createdAt || "",
        customerId: inv.customerId,
        customerName: inv.customerName || "Unknown Customer",
        salesRepName: inv.salesRepName || "Unknown",
        totalAmount: inv.totalAmount || 0,
        paidAmount: inv.paidAmount || 0,
        dueAmount: inv.dueAmount || 0,
        status: inv.status,
        orderStatus: inv.orderStatus || "Pending",
        itemsCount: 0,
        businessId: inv.businessId,
      })),
    [rawInvoices]
  );

  const reps = useMemo(
    () =>
      Array.from(
        new Set(
          allUsers
            .filter((u: any) => u.role === "rep")
            .map((u: any) => u.fullName)
        )
      ),
    [allUsers]
  );

  // --- 3. Filter Logic ---
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.salesRepName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesRep = repFilter === "all" || inv.salesRepName === repFilter;

    return matchesSearch && matchesStatus && matchesRep;
  });

  // --- 4. Sort Logic ---
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === "date" || sortField === "createdAt") {
      return sortOrder === "asc"
        ? new Date(aVal).getTime() - new Date(bVal).getTime()
        : new Date(bVal).getTime() - new Date(aVal).getTime();
    }

    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // --- 5. Pagination ---
  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);
  const paginatedInvoices = sortedInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/dashboard/admin/invoices/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/dashboard/admin/invoices/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete invoice");
        return;
      }
      toast.success("Invoice deleted successfully");
      invalidatePaymentCaches();
      invalidateFinanceCaches();
      fetchInvoices();
    } catch {
      toast.error("Failed to delete invoice");
    }
  };
  // Synchronize filters to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEYS.search, searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEYS.status, statusFilter);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEYS.rep, repFilter);
    }
  }, [repFilter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEYS.sortField, sortField);
    }
  }, [sortField]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEYS.sortOrder, sortOrder);
    }
  }, [sortOrder]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEYS.page, currentPage.toString());
    }
  }, [currentPage]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setCurrentPage(1);
  }, [searchQuery, statusFilter, repFilter]);

  const handleRefreshAll = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setRepFilter("all");
    setSortField("createdAt");
    setSortOrder("desc");
    setCurrentPage(1);
    Object.values(STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k));
    fetchInvoices();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Bills</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer bills, track payments, and view order status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefreshAll}
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => toast.info("Export Excel coming soon")}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />{" "}
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info("Export PDF coming soon")}
              >
                <FileText className="w-4 h-4 mr-2 text-red-600" /> Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() => router.push("/dashboard/admin/invoices/create")}
          >
            <Plus className="w-4 h-4 mr-2" /> Create Bill
          </Button>
        </div>
      </div>

      <InvoiceStats invoices={invoices} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* Search Bar */}
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoice, customer..."
                className="pl-9 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-3 h-3" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="truncate">
                      {repFilter === "all" ? "All Reps" : repFilter}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Representatives</SelectItem>
                  {reps.map((repName) => (
                    <SelectItem key={repName} value={repName}>
                      {repName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <InvoiceTable
            invoices={paginatedInvoices}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEdit={handleEdit}
            onView={handleView}
            onDelete={handleDelete}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
