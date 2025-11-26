// app/dashboard/admin/invoices/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
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

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all"); // NEW: Rep Filter
  const [reps, setReps] = useState<string[]>([]); // NEW: Rep List

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- 1. Fetch Invoices ---
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();

      const mappedInvoices: Invoice[] = data.map((inv: any) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        date: inv.createdAt
          ? inv.createdAt.split("T")[0]
          : new Date().toISOString().split("T")[0],
        customerId: inv.customerId,
        customerName: inv.customerName || "Unknown Customer",
        salesRepName: inv.salesRepName || "Unknown",
        totalAmount: inv.totalAmount || 0,
        paidAmount: inv.paidAmount || 0,
        dueAmount: inv.dueAmount || 0,
        status: inv.status,
        itemsCount: 0,
      }));

      setInvoices(mappedInvoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- 2. Fetch Reps for Dropdown ---
  useEffect(() => {
    const fetchReps = async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const users = await res.json();
          // Filter users with role 'rep' and get their names
          const repNames = users
            .filter((u: any) => u.role === "rep")
            .map((u: any) => u.fullName);
          // Remove duplicates just in case
          setReps(Array.from(new Set(repNames)));
        }
      } catch (error) {
        console.error("Failed to load reps", error);
      }
    };
    fetchReps();
    fetchInvoices();
  }, [fetchInvoices]);

  // --- 3. Filter Logic ---
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.salesRepName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    // NEW: Rep Filter Check
    const matchesRep = repFilter === "all" || inv.salesRepName === repFilter;

    return matchesSearch && matchesStatus && matchesRep;
  });

  // --- 4. Sort Logic ---
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === "date") {
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

  // --- 5. Pagination Logic ---
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, repFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Bills</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer bills and payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchInvoices}
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Generate Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => toast.info("Export coming soon")}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />{" "}
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info("Export coming soon")}
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
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoice, customer..."
                className="pl-9 w-1/2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Status Filter */}
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

              {/* NEW: Representative Filter */}
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
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
