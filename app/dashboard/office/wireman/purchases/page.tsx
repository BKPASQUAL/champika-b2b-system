// app/dashboard/office/wireman/purchases/page.tsx
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
import { Search, Filter, RefreshCw, Factory, Plus } from "lucide-react";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

import { Purchase, SortField, SortOrder } from "./types";
import { PurchaseStats } from "./_components/PurchaseStats";
import { PurchaseTable } from "./_components/PurchaseTable";

export default function WiremanPurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(
    null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("purchaseDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user && user.businessId) {
      setCurrentBusinessId(user.businessId);
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    if (!currentBusinessId) return;

    try {
      setLoading(true);
      // Fetch purchases for Wireman Agency
      const res = await fetch(`/api/purchases?businessId=${currentBusinessId}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();

      const mappedData: Purchase[] = data.map((p: any) => ({
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
      }));

      setPurchases(mappedData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load purchase history");
    } finally {
      setLoading(false);
    }
  }, [currentBusinessId]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // Filter
  const filtered = purchases.filter((p) => {
    const matchesSearch =
      p.purchaseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.invoiceNo &&
        p.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()));

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
    router.push(`/dashboard/office/wireman/purchases/${purchase.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-900 flex items-center gap-2">
            Supplier Bills <Factory className="w-6 h-6 text-red-600" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Wireman Agency purchasing and accounts payable.
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
              router.push("/dashboard/office/wireman/purchases/create")
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
