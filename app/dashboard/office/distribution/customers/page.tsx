// app/dashboard/office/distribution/customers/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Plus,
  FileSpreadsheet,
  Search,
  RefreshCw,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BUSINESS_IDS } from "@/app/config/business-constants";

import { Customer, SortField, SortOrder, CustomerFormData } from "./types";
import { CustomerTable } from "./_components/CustomerTable";
import { CustomerDialogs } from "./_components/CustomerDialogs";

export default function DistributionCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Distribution Business ID
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("shopName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  const [formData, setFormData] = useState<CustomerFormData>({
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    route: "",
    status: "Active",
    creditLimit: 0,
    businessId: distributionBusinessId, // Locked to Distribution
  });

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch only for Distribution business
      const res = await fetch(
        `/api/customers?businessId=${distributionBusinessId}`
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      toast.error("Error loading customer data");
    } finally {
      setLoading(false);
    }
  }, [distributionBusinessId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Derived Data
  const routes = ["all", ...Array.from(new Set(customers.map((c) => c.route)))];

  // Filter & Sort
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery);
    const matchesRoute =
      routeFilter === "all" || customer.route === routeFilter;
    const matchesStatus =
      statusFilter === "all" || customer.status === statusFilter;
    return matchesSearch && matchesRoute && matchesStatus;
  });

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const paginatedCustomers = sortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSaveCustomer = async () => {
    if (!formData.shopName || !formData.phone || !formData.route) {
      toast.error("Please fill required fields (Shop, Phone, Route)");
      return;
    }

    // Double check ID
    if (!formData.businessId) {
      formData.businessId = distributionBusinessId;
    }

    try {
      if (selectedCustomer) {
        // UPDATE (PATCH)
        const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update");
        toast.success("Customer updated successfully");
      } else {
        // CREATE (POST)
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create");
        toast.success("Customer created successfully");
      }
      setIsAddDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Customer deleted");
      setIsDeleteDialogOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      shopName: "",
      ownerName: "",
      phone: "",
      email: "",
      address: "",
      route: "",
      status: "Active",
      creditLimit: 0,
      businessId: distributionBusinessId,
    });
    setSelectedCustomer(null);
  };

  const generateExcel = () => {
    if (sortedCustomers.length === 0) return;
    const data = sortedCustomers.map((c) => ({
      ID: c.customerId,
      Shop: c.shopName,
      Owner: c.ownerName,
      Phone: c.phone,
      Route: c.route,
      Address: c.address,
      Status: c.status,
      "Outstanding (LKR)": c.outstandingBalance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "distribution-customers.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-blue-900">
            Distribution Customers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage distribution network and shops
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchCustomers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Reports
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={generateExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />{" "}
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Filter & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shops, owners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "all" ? "All Routes" : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CustomerTable
            customers={paginatedCustomers}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEdit={(c) => {
              setFormData({
                shopName: c.shopName,
                ownerName: c.ownerName,
                phone: c.phone,
                email: c.email,
                address: c.address,
                route: c.route,
                status: c.status,
                creditLimit: c.creditLimit,
                businessId: distributionBusinessId,
              });
              setSelectedCustomer(c);
              setIsAddDialogOpen(true);
            }}
            onDelete={(c) => {
              setSelectedCustomer(c);
              setIsDeleteDialogOpen(true);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <CustomerDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSaveCustomer}
        selectedCustomer={selectedCustomer}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
