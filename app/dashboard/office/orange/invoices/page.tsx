"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
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
  Printer,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";

import { Invoice, SortField, SortOrder } from "./types";
import { InvoiceTable } from "./_components/InvoiceTable";
import { InvoiceStats } from "./_components/InvoiceStats";
import { downloadOutstandingReport, printOutstandingReport } from "./outstanding-report";

const NUMBER_WORDS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
  "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
  "18": "eighteen", "19": "nineteen", "20": "twenty", "24": "twenty four",
  "30": "thirty", "40": "forty", "50": "fifty", "100": "hundred",
};
const WORD_NUMBERS: Record<string, string> = Object.fromEntries(
  Object.entries(NUMBER_WORDS).map(([n, w]) => [w, n])
);
function getSearchTerms(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const terms = new Set<string>([q]);
  if (NUMBER_WORDS[q]) terms.add(NUMBER_WORDS[q]);
  if (WORD_NUMBERS[q]) terms.add(WORD_NUMBERS[q]);
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (word.includes(q)) { terms.add(word); terms.add(num); }
  });
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (num.startsWith(q)) { terms.add(num); terms.add(word); }
  });
  return Array.from(terms);
}

export default function InvoicesPage() {
  const router = useRouter();
  const [currentBusinessId] = useState<string>(() => {
    const user = getUserBusinessContext();
    return user?.businessId ?? BUSINESS_IDS.ORANGE_AGENCY;
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    data: rawInvoices = [],
    loading,
    refetch: fetchInvoices,
  } = useCachedFetch<any[]>(
    `/api/invoices?businessId=${currentBusinessId}`,
    [],
    () => toast.error("Failed to load invoices")
  );

  const { data: allUsers = [] } = useCachedFetch<any[]>("/api/users", []);

  const invoices: Invoice[] = useMemo(
    () =>
      rawInvoices.map((inv: any) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        date: inv.date || (inv.createdAt ? inv.createdAt.split("T")[0] : new Date().toISOString().split("T")[0]),
        customerId: inv.customerId,
        customerName: inv.customerName || "Unknown Customer",
        salesRepName: inv.salesRepName || "Unknown",
        totalAmount: inv.totalAmount || 0,
        paidAmount: inv.paidAmount || 0,
        dueAmount: inv.dueAmount || 0,
        status: inv.status,
        orderStatus: inv.orderStatus || "Pending",
        itemsCount: 0,
      })),
    [rawInvoices]
  );

  const reps = useMemo(
    () => Array.from(new Set(allUsers.filter((u: any) => u.role === "rep").map((u: any) => u.fullName))),
    [allUsers]
  );

  // 4. Filter Logic
  const filteredInvoices = invoices.filter((inv) => {
    const searchTerms = getSearchTerms(searchQuery);
    const haystack = [inv.invoiceNo, inv.customerName, inv.salesRepName]
      .join(" ").toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      searchTerms.some((term) => haystack.includes(term));

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesRep = repFilter === "all" || inv.salesRepName === repFilter;

    return matchesSearch && matchesStatus && matchesRep;
  });

  // 5. Sort Logic
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

  // 6. Pagination
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
    router.push(`/dashboard/office/orange/invoices/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/dashboard/office/orange/invoices/${id}`);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, repFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-orange-900">
            Customer Bills
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage distribution bills, track payments, and view status.
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
                onClick={() => downloadOutstandingReport(invoices, repFilter)}
              >
                <FileText className="w-4 h-4 mr-2 text-red-600" /> Outstanding Bills (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => printOutstandingReport(invoices, repFilter)}
              >
                <Printer className="w-4 h-4 mr-2 text-red-600" /> Print Outstanding Bills
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() =>
              router.push("/dashboard/office/orange/invoices/create")
            }
            className="bg-orange-600 hover:bg-orange-700"
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
                className="pl-9 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto">
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
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
