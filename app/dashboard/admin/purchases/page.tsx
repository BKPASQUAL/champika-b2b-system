"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

import { PurchaseHeader } from "./_components/PurchaseHeader";
import { PurchaseStats } from "./_components/PurchaseStats";
import { PurchaseFilters } from "./_components/PurchaseFilters";
import { PurchaseTable } from "./_components/PurchaseTable";
import { Purchase, SortField, SortOrder } from "./types";

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("purchaseDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- 1. Fetch Real Data from API ---
  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/purchases");
      if (!response.ok) throw new Error("Failed to fetch purchases");
      const data = await response.json();

      // Map API response to Frontend Type
      // Note: The list API doesn't return 'items' array to save bandwidth, so we set it to empty []
      const mappedData: Purchase[] = data.map((p: any) => ({
        id: p.id,
        purchaseId: p.purchaseId,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        invoiceNo: p.invoiceNo || "-",
        purchaseDate: p.purchaseDate,
        arrivalDate: p.arrivalDate,
        billingDate: p.arrivalDate, // Fallback
        status: p.status,
        paymentStatus: p.paymentStatus,
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
        items: [], // Empty for list view
      }));

      setPurchases(mappedData);
    } catch (error) {
      toast.error("Error loading purchases");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // --- 2. Filter Logic ---
  const filteredPurchases = purchases.filter((p) => {
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
  }, [searchQuery, statusFilter]);

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
        onExportPDF={() => toast.info("Export coming soon")}
      />

      {/* Stats using real data */}
      <PurchaseStats purchases={purchases} />

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
