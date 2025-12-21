"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Order, SortField, SortOrder, OrderStatus } from "./types";
import { OrderStats } from "./_components/OrderStats";
import { OrderFilters } from "./_components/OrderFilters";
import { OrderTable } from "./_components/OrderTable";

export default function OrdersPage() {
  const router = useRouter();

  // State for data
  const [orders, setOrders] = useState<Order[]>([]);
  const [reps, setReps] = useState<string[]>([]); // State for reps
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");

  // Sort & Pagination State
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. Fetch Orders
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/orders");

      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }

      const data = await response.json();
      setOrders(data);
    } catch (err: any) {
      console.error("Error loading orders:", err);
      setError("Failed to load orders. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Reps
  const fetchReps = async () => {
    try {
      const response = await fetch("/api/users?role=rep");

      if (response.ok) {
        const users = await response.json();
        // Extract full names from the user objects
        const repNames = users.map((u: any) => u.fullName); // Use .fullName, not .full_name          .filter((name: any) => typeof name === "string");

        setReps(repNames);
      }
    } catch (err) {
      console.error("Failed to fetch reps:", err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchOrders();
    fetchReps();
  }, []);

  // Filter Logic
  const filteredOrders = orders.filter((order) => {
    // Updated search to include invoiceNo
    const matchesSearch =
      (order.invoiceNo?.toLowerCase() || "").includes(
        searchQuery.toLowerCase()
      ) ||
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const matchesRep = repFilter === "all" || order.salesRep === repFilter;

    return matchesSearch && matchesStatus && matchesRep;
  });

  // Sorting Logic
  const sortedOrders = [...filteredOrders].sort((a, b) => {
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
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = sortedOrders.slice(
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

  const handleUpdateStatus = async (order: Order, newStatus: OrderStatus) => {
    const previousOrders = [...orders];
    const updatedOrders = orders.map((o) =>
      o.id === order.id ? { ...o, status: newStatus } : o
    );
    setOrders(updatedOrders);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed");
    } catch (error) {
      console.error("Update failed:", error);
      setOrders(previousOrders);
      alert("Failed to update order status.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchOrders}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track order workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />{" "}
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="w-4 h-4 mr-2 text-red-600" /> Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => router.push("/dashboard/admin/orders/create")}>
            <Plus className="w-4 h-4 mr-2" /> Create Order
          </Button>
        </div>
      </div>

      <OrderStats orders={orders} />

      <Card>
        <CardHeader>
          {/* Passed reps prop here */}
          <OrderFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            repFilter={repFilter}
            setRepFilter={setRepFilter}
            reps={reps}
          />
        </CardHeader>
        <CardContent>
          <OrderTable
            orders={paginatedOrders}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onView={(order) =>
              router.push(`/dashboard/admin/orders/${order.id}`)
            }
            onUpdateStatus={handleUpdateStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
