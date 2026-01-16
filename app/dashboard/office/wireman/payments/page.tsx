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
import { Search, Plus, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

// Local Imports
import { Payment, SortField, SortOrder } from "./types";
import { PaymentStats } from "./_components/PaymentStats";
import { PaymentTable } from "./_components/PaymentTable";
import { PaymentDialogs } from "./_components/PaymentDialogs";
import { CreatePaymentDialog } from "./_components/CreatePaymentDialog";

export default function WiremanPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(
    null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user && user.businessId) {
      setCurrentBusinessId(user.businessId);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!currentBusinessId) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/payments?businessId=${currentBusinessId}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      const data = await res.json();

      // ✅ FIX: Correctly map API fields to Frontend Types
      const mapped: Payment[] = data.map((p: any) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        // Optional chaining in case relation is null
        invoiceNo: p.invoices?.invoice_no || "N/A",
        customerId: p.customer_id,
        // API returns customers: { name: "..." }
        customerName: p.customers?.name || "Unknown Customer",
        amount: Number(p.amount),
        date: p.payment_date,
        // API returns payment_method
        method: p.payment_method || "Cash",
        // API returns cheque_number
        chequeNo: p.cheque_number,
        chequeDate: p.cheque_date,
        chequeStatus: p.cheque_status,
        collectedBy: "Office", // Default or fetch from profile if available
      }));

      setPayments(mapped);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  }, [currentBusinessId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.chequeNo && p.chequeNo.includes(searchQuery));

    const matchesMethod = methodFilter === "all" || p.method === methodFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (p.method === "Cheque" && p.chequeStatus === statusFilter);

    return matchesSearch && matchesMethod && matchesStatus;
  });

  const sortedPayments = [...filteredPayments].sort((a, b) => {
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

  const totalPages = Math.ceil(sortedPayments.length / itemsPerPage);
  const paginatedPayments = sortedPayments.slice(
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-900">
            Payments Received
          </h1>
          <p className="text-muted-foreground mt-1">
            Track incoming payments and manage cheque clearings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchPayments}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Record Payment
          </Button>
        </div>
      </div>

      <PaymentStats payments={payments} />

      <Card className="border-red-100">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer, invoice #, or cheque #..."
                className="pl-9 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[140px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-3 h-3" />
                    <SelectValue placeholder="Method" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>{" "}
                  {/* Lowercase to match API usually */}
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank">Transfer</SelectItem>
                </SelectContent>
              </Select>

              {methodFilter === "cheque" && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Cheque Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Cleared">Cleared</SelectItem>
                    <SelectItem value="Bounced">Bounced</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PaymentTable
            payments={paginatedPayments}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onUpdateStatus={(p) => {
              setSelectedPayment(p);
              setIsDialogOpen(true);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <PaymentDialogs
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        selectedPayment={selectedPayment}
        onUpdate={fetchPayments}
      />

      <CreatePaymentDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onPaymentSuccess={fetchPayments}
      />
    </div>
  );
}
