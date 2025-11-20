// app/dashboard/admin/invoices/page.tsx
"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Invoice, SortField, SortOrder, PaymentStatus } from "./types";
import { InvoiceTable } from "./_components/InvoiceTable";
import { InvoiceStats } from "./_components/InvoiceStats";

// Mock Data
const mockInvoices: Invoice[] = [
  {
    id: "INV-001",
    invoiceNo: "INV-2024-001",
    date: "2025-02-18",
    customerId: "C-001",
    customerName: "Saman Electronics",
    totalAmount: 150000,
    paidAmount: 50000,
    dueAmount: 100000,
    status: "Partial",
    itemsCount: 5,
  },
  {
    id: "INV-002",
    invoiceNo: "INV-2024-002",
    date: "2025-02-15",
    customerId: "C-002",
    customerName: "City Hardware",
    totalAmount: 85000,
    paidAmount: 85000,
    dueAmount: 0,
    status: "Paid",
    itemsCount: 12,
  },
  {
    id: "INV-003",
    invoiceNo: "INV-2024-003",
    date: "2025-01-20",
    customerId: "C-003",
    customerName: "Lanka Traders",
    totalAmount: 240000,
    paidAmount: 0,
    dueAmount: 240000,
    status: "Overdue",
    itemsCount: 8,
  },
  {
    id: "INV-004",
    invoiceNo: "INV-2024-004",
    date: "2025-02-19", // Today/Recent
    customerId: "C-002",
    customerName: "City Hardware",
    totalAmount: 45000,
    paidAmount: 0,
    dueAmount: 45000,
    status: "Unpaid",
    itemsCount: 3,
  },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter Logic
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sort Logic
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

  // Pagination Logic
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Generate Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />{" "}
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="w-4 h-4 mr-2 text-red-600" /> Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Create Bill Button */}
          <Button
            onClick={() => router.push("/dashboard/admin/invoices/create")}
          >
            <Plus className="w-4 h-4 mr-2" /> Create Bill
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <InvoiceStats invoices={invoices} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoice # or customer..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Status" />
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
        </CardHeader>
        <CardContent>
          <InvoiceTable
            invoices={paginatedInvoices}
            loading={false}
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
