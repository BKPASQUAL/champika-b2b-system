// app/dashboard/admin/orders/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Plus } from "lucide-react";
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

// Mock Data
const mockOrders: Order[] = [
  {
    id: "1",
    orderId: "ORD-2025-001",
    customerName: "Saman Kumara",
    shopName: "Saman Electronics",
    date: "2025-02-20",
    totalAmount: 15400,
    itemCount: 12,
    status: "Pending",
    paymentStatus: "Unpaid",
    salesRep: "Ajith Bandara",
  },
  {
    id: "2",
    orderId: "ORD-2025-002",
    customerName: "Nimal Perera",
    shopName: "City Hardware",
    date: "2025-02-19",
    totalAmount: 85000,
    itemCount: 45,
    status: "Processing",
    paymentStatus: "Unpaid",
    salesRep: "Chathura Perera",
  },
  {
    id: "3",
    orderId: "ORD-2025-003",
    customerName: "Kamal Silva",
    shopName: "Lanka Traders",
    date: "2025-02-19",
    totalAmount: 24500,
    itemCount: 8,
    status: "Checking",
    paymentStatus: "Unpaid",
    salesRep: "Dilshan Silva",
  },
  {
    id: "4",
    orderId: "ORD-2025-004",
    customerName: "Sunil Das",
    shopName: "Ruhuna Motors",
    date: "2025-02-18",
    totalAmount: 120000,
    itemCount: 60,
    status: "Loading",
    paymentStatus: "Partial",
    salesRep: "Ajith Bandara",
  },
  {
    id: "5",
    orderId: "ORD-2025-005",
    customerName: "Mahesh",
    shopName: "Global Paints",
    date: "2025-02-18",
    totalAmount: 45000,
    itemCount: 22,
    status: "Delivered",
    paymentStatus: "Paid",
    salesRep: "Chathura Perera",
  },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(mockOrders);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");

  // Sort & Page
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Logic
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const matchesRep = repFilter === "all" || order.salesRep === repFilter;

    return matchesSearch && matchesStatus && matchesRep;
  });

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

  const handleUpdateStatus = (order: Order, newStatus: OrderStatus) => {
    // Simulate API call
    const updated = orders.map((o) =>
      o.id === order.id ? { ...o, status: newStatus } : o
    );
    setOrders(updated);
  };

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

      {/* Order Workflow Stats */}
      <OrderStats orders={orders} />

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <OrderFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            repFilter={repFilter}
            setRepFilter={setRepFilter}
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
            onView={(order) => console.log("View order", order.id)}
            onUpdateStatus={handleUpdateStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
