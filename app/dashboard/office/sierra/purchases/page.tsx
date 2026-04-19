// app/dashboard/office/sierra/purchases/page.tsx
"use client";

import React, { useState, useMemo } from "react";
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
import { Search, Filter, RefreshCw, Factory, Plus } from "lucide-react";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";

import { Purchase, SortField, SortOrder } from "./types";
import { PurchaseStats } from "./_components/PurchaseStats";
import { PurchaseTable } from "./_components/PurchaseTable";

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

export default function SierraPurchasesPage() {
  const router = useRouter();
  const [currentBusinessId] = useState<string>(() => {
    const user = getUserBusinessContext();
    return user?.businessId ?? BUSINESS_IDS.SIERRA_AGENCY;
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("purchaseDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    data: rawPurchases = [],
    loading,
    refetch: fetchPurchases,
  } = useCachedFetch<any[]>(
    `/api/purchases?businessId=${currentBusinessId}`,
    [],
    () => toast.error("Failed to load purchase history")
  );

  const purchases: Purchase[] = useMemo(
    () =>
      rawPurchases.map((p: any) => ({
        id: p.id,
        purchaseId: p.purchaseId,
        supplierId: p.supplierId,
        supplierName: p.supplierName || "Unknown Supplier",
        invoiceNo: p.invoiceNo || "-",
        purchaseDate: p.purchaseDate,
        status: p.status,
        paymentStatus: p.paymentStatus,
        totalAmount: Number(p.totalAmount),
        paidAmount: Number(p.paidAmount),
        items: p.items || [],
      })),
    [rawPurchases]
  );

  // Filter
  const filtered = purchases.filter((p) => {
    const searchTerms = getSearchTerms(searchQuery);
    const haystack = [p.purchaseId, p.supplierName, p.invoiceNo ?? ""]
      .join(" ").toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      searchTerms.some((term) => haystack.includes(term));

    const matchesPayment =
      paymentFilter === "all" || p.paymentStatus === paymentFilter;

    return matchesSearch && matchesPayment;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === "purchaseDate") {
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

  // Pagination
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = sorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleView = (purchase: Purchase) => {
    router.push(`/dashboard/office/sierra/purchases/${purchase.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-900 flex items-center gap-2">
            Supplier Bills <Factory className="w-6 h-6 text-red-600" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Sierra Agency purchasing and accounts payable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchPurchases}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() =>
              router.push("/dashboard/office/sierra/purchases/create")
            }
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> New Bill
          </Button>
        </div>
      </div>

      <PurchaseStats purchases={purchases} />

      <Card className="border-red-100">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search PO #, Invoice, or Supplier..."
                className="pl-9 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-3 h-3" />
                    <SelectValue placeholder="Payment Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PurchaseTable
            purchases={paginated}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
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
