"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

import { PurchaseHeader } from "./_components/PurchaseHeader";
import { PurchaseStats } from "./_components/PurchaseStats";
import { PurchaseFilters } from "./_components/PurchaseFilters";
import { PurchaseTable } from "./_components/PurchaseTable";
import { MonthlyPurchaseSummary } from "./_components/MonthlyPurchaseSummary";
import { downloadPurchaseReport } from "./purchase-report";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Purchase, SortField, SortOrder } from "./types";

export default function PurchasesPage() {
  const router = useRouter();
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Month filter: "YYYY-MM" or "" for all time. Defaults to this month.
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("purchaseDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    data: rawPurchases = [],
    loading,
    refetch: fetchPurchases,
  } = useCachedFetch<any[]>("/api/purchases", [], () =>
    toast.error("Error loading purchases")
  );

  const purchases: Purchase[] = useMemo(
    () =>
      rawPurchases.map((p: any) => ({
        id: p.id,
        purchaseId: p.purchaseId,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        invoiceNo: p.invoiceNo || "-",
        purchaseDate: p.purchaseDate,
        arrivalDate: p.arrivalDate,
        billingDate: p.arrivalDate,
        status: p.status,
        paymentStatus: p.paymentStatus,
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
        businessId: p.businessId || null,
        businessName: p.businessName || null,
        items: [],
      })),
    [rawPurchases]
  );

  // --- 1b. Month Filter ---
  const monthPurchases = useMemo(
    () =>
      selectedMonth
        ? purchases.filter(
            (p) => (p.purchaseDate || "").slice(0, 7) === selectedMonth
          )
        : purchases,
    [purchases, selectedMonth]
  );

  const monthLabel = selectedMonth
    ? new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "All Time";

  // --- 2. Filter Logic ---
  const filteredPurchases = monthPurchases.filter((p) => {
    const matchesSearch =
      p.purchaseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.invoiceNo &&
        p.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // --- 3. Sort Logic ---
  const sortedPurchases = [...filteredPurchases].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // --- 4. Pagination Logic ---
  const totalPages = Math.ceil(sortedPurchases.length / itemsPerPage);
  const paginatedPurchases = sortedPurchases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, selectedMonth]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleDelete = async (purchase: Purchase) => {
    if (!confirm(`Are you sure you want to delete ${purchase.purchaseId}?`))
      return;
    // Ideally you should implement DELETE /api/purchases/[id]
    toast.info("Delete functionality requires backend implementation.");
  };

  return (
    <div className="space-y-6">
      <PurchaseHeader
        onAddClick={() => router.push("/dashboard/admin/purchases/create")}
        onExportExcel={() => toast.info("Export coming soon")}
        onExportPDF={() => downloadPurchaseReport(monthPurchases, monthLabel)}
      />

      {/* Month selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Month:</span>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-[180px]"
        />
        <Button
          variant={selectedMonth ? "outline" : "default"}
          size="sm"
          onClick={() => setSelectedMonth("")}
        >
          All Time
        </Button>
      </div>

      {/* Stats for the selected month */}
      <PurchaseStats purchases={monthPurchases} />

      <MonthlyPurchaseSummary
        purchases={monthPurchases}
        monthLabel={monthLabel}
      />

      <Card>
        <CardHeader>
          <PurchaseFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </CardHeader>
        <CardContent>
          <PurchaseTable
            purchases={paginatedPurchases}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEdit={(p) => {
              // Navigate to edit page or show dialog (mock for now)
              toast.info("Edit feature coming soon");
            }}
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
