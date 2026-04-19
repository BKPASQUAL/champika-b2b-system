"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

// Constants
import { BUSINESS_IDS } from "@/app/config/business-constants";

import { PurchaseHeader } from "./_components/PurchaseHeader";
import { PurchaseStats } from "./_components/PurchaseStats";
import { PurchaseFilters } from "./_components/PurchaseFilters";
import { PurchaseTable } from "./_components/PurchaseTable";
import { Purchase, SortField, SortOrder } from "./types";

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

export default function DistributionPurchasesPage() {
  const router = useRouter();
  const CURRENT_BUSINESS_ID = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("purchaseDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    data: rawPurchases = [],
    loading,
    refetch: fetchPurchases,
  } = useCachedFetch<any[]>("/api/purchases", [], () => toast.error("Error loading purchases"));

  const purchases: Purchase[] = useMemo(
    () =>
      rawPurchases
        .map((p: any) => ({
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
        }))
        .filter((p: Purchase) => p.businessId === CURRENT_BUSINESS_ID),
    [rawPurchases, CURRENT_BUSINESS_ID]
  );

  // --- 2. Filter Logic ---
  const filteredPurchases = purchases.filter((p) => {
    const searchTerms = getSearchTerms(searchQuery);
    const haystack = [p.purchaseId, p.supplierName, p.invoiceNo ?? ""]
      .join(" ").toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      searchTerms.some((term) => haystack.includes(term));
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
    toast.info("Delete functionality requires backend implementation.");
  };

  return (
    <div className="space-y-6">
      <PurchaseHeader
        onAddClick={() =>
          router.push("/dashboard/office/distribution/purchases/create")
        }
        onExportExcel={() => toast.info("Export coming soon")}
        onExportPDF={() => toast.info("Export coming soon")}
      />

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
            // ✅ Added View Logic
            onView={(p) =>
              router.push(`/dashboard/office/distribution/purchases/${p.id}`)
            }
            onEdit={(p) => {
              // Note: Create edit page if needed, for now logic is same as View
              toast.info("Edit feature not available yet");
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
