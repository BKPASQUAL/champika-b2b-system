// app/dashboard/rep/customers/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  MapPin,
  Phone,
  Loader2,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

// Types
type CustomerStatus = "Active" | "Inactive" | "Blocked";

interface Customer {
  id: string;
  customerId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  route: string;
  status: CustomerStatus;
  creditLimit: number;
  outstandingBalance: number;
  lastOrderDate: string;
}

export default function RepCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all"); // <--- ADDED Route Filter State

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchMyCustomers = async () => {
      try {
        setLoading(true);

        // 1. Get Current User ID from Local Storage
        const storedUser = localStorage.getItem("currentUser");
        if (!storedUser) {
          toast.error("User session not found. Please login again.");
          return;
        }

        const userObj = JSON.parse(storedUser);
        let repId = userObj.id;

        // Fallback: Find ID by email if not in local storage
        if (!repId) {
          const userRes = await fetch("/api/users");
          const users = await userRes.json();
          const me = users.find((u: any) => u.email === userObj.email);
          if (me) repId = me.id;
        }

        if (!repId) {
          toast.error("Could not identify sales representative account.");
          return;
        }

        // 2. Fetch Customers filtered by Rep ID
        const res = await fetch(`/api/customers?repId=${repId}`);

        if (!res.ok) throw new Error("Failed to load customers");

        const data = await res.json();
        setCustomers(data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load customers");
      } finally {
        setLoading(false);
      }
    };

    fetchMyCustomers();
  }, []);

  // --- Reset Pagination when filters change ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, routeFilter]);

  // --- Calculations for Cards ---
  const totalCustomers = customers.length;
  const totalOutstanding = customers.reduce(
    (sum, c) => sum + (c.outstandingBalance || 0),
    0
  );
  const activeCustomers = customers.filter((c) => c.status === "Active").length;

  // --- Unique Routes for Dropdown ---
  const uniqueRoutes = useMemo(() => {
    const routes = new Set(customers.map((c) => c.route).filter(Boolean));
    return Array.from(routes).sort();
  }, [customers]);

  // --- Filter Logic ---
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesRoute = routeFilter === "all" || c.route === routeFilter; // <--- ADDED Route Logic

    return matchesSearch && matchesStatus && matchesRoute;
  });

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-700 border-green-200";
      case "Inactive":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "Blocked":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My Customers</h1>
        <p className="text-muted-foreground">
          Manage your customer base and view credit details.
        </p>
      </div>

      {/* KPI Cards Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Customers
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCustomers} Active shops
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Outstanding
            </CardTitle>
            <Wallet className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              LKR {totalOutstanding.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Credit to be collected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shop, name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Route Filter - ADDED */}
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="w-[160px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <SelectValue placeholder="Route" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  {uniqueRoutes.map((route) => (
                    <SelectItem key={route} value={route}>
                      {route}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Details</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    Outstanding (LKR)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 opacity-50" />
                        <p>No customers found matching your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 bg-blue-50 text-blue-700 border border-blue-100">
                            <AvatarFallback className="font-semibold">
                              {customer.shopName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-gray-900">
                              {customer.shopName}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {customer.ownerName && (
                                <span>{customer.ownerName}</span>
                              )}
                              <span className="flex items-center gap-0.5">
                                <Phone className="h-3 w-3" /> {customer.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {customer.route}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getStatusColor(customer.status)}
                        >
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className={`font-semibold ${
                              customer.outstandingBalance > 0
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {customer.outstandingBalance.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Limit: {customer.creditLimit.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filteredCustomers.length > 0 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredCustomers.length)}{" "}
                of {filteredCustomers.length} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
