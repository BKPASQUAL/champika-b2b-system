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
import { BUSINESS_IDS } from "@/app/config/business-constants";

// Local Imports
import { Payment, SortField, SortOrder } from "./types";
import { PaymentStats } from "./_components/PaymentStats";
import { PaymentTable } from "./_components/PaymentTable";
import { PaymentDialogs } from "./_components/PaymentDialogs";
import { CreatePaymentDialog } from "./_components/CreatePaymentDialog";

export default function SierraPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDue, setTotalDue] = useState(0);
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
    setCurrentBusinessId(user?.businessId ?? BUSINESS_IDS.SIERRA_AGENCY);
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!currentBusinessId) return;

    try {
      setLoading(true);
      const [paymentsRes, invoicesRes] = await Promise.all([
        fetch(`/api/payments?businessId=${currentBusinessId}`),
        fetch(`/api/invoices?businessId=${currentBusinessId}`),
      ]);

      if (!paymentsRes.ok) throw new Error("Failed to fetch payments");
      const data = await paymentsRes.json();

      // Correctly map API fields to Frontend Types
      const mapped: Payment[] = data.map((p: any) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        invoiceNo: p.invoices?.invoice_no || "N/A",
        customerId: p.customer_id,
        customerName: p.customers?.name || "Unknown Customer",
        amount: Number(p.amount),
        date: p.payment_date,
        method: p.payment_method || "Cash",
        chequeNo: p.cheque_number,
        chequeDate: p.cheque_date,
        chequeStatus: p.cheque_status,
        collectedBy: "Office",
      }));
      setPayments(mapped);

      // Calculate total due from invoices
      if (invoicesRes.ok) {
        const invoices = await invoicesRes.json();
        const due = invoices
          .filter((inv: any) => inv.paymentStatus !== "Paid" && (inv.dueAmount ?? 0) > 0)
          .reduce((sum: number, inv: any) => sum + (inv.dueAmount ?? 0), 0);
        setTotalDue(due);
      }
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
          <h1 className="text-3xl font-bold tracking-tight text-purple-900">
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Record Payment
          </Button>
        </div>
      </div>

      <PaymentStats payments={payments} totalDue={totalDue} />

      <Card className="border-purple-100">
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
                  <SelectItem value="cash">Cash</SelectItem>
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
