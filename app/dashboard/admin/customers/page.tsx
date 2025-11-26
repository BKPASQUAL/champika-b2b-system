"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Plus,
  FileSpreadsheet,
  FileText,
  Search,
  Users,
  TrendingUp,
  Wallet,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { Customer, SortField, SortOrder, CustomerFormData } from "./types";
import { CustomerTable } from "./_components/CustomerTable";
import { CustomerDialogs } from "./_components/CustomerDialogs";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("shopName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  // Form Data
  const [formData, setFormData] = useState<CustomerFormData>({
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    route: "",
    status: "Active",
    creditLimit: 0,
  });

  // --- 1. API: Fetch Customers ---
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      toast.error("Error loading customer data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // --- 2. Derived Data for Stats & Filters ---
  const routes = ["all", ...Array.from(new Set(customers.map((c) => c.route)))];

  const totalOutstanding = customers.reduce(
    (sum, c) => sum + (c.outstandingBalance || 0),
    0
  );

  // --- 3. Filter & Sort Logic ---
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

  // --- 4. Handlers ---

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSaveCustomer = async () => {
    if (!formData.shopName || !formData.phone || !formData.route) {
      toast.error("Please fill required fields (Shop Name, Phone, Route)");
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedCustomer) {
        // UPDATE (PATCH)
        const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update customer");

        toast.success("Customer updated successfully");
      } else {
        // CREATE (POST)
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create customer");

        toast.success("Customer created successfully");
      }

      setIsAddDialogOpen(false);
      resetForm();
      fetchCustomers(); // Refresh list
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete customer");
      }

      toast.success("Customer deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedCustomer(null);
      fetchCustomers(); // Refresh list
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
    });
    setSelectedCustomer(null);
  };

  // --- 5. Reports ---
  const generateExcel = () => {
    if (sortedCustomers.length === 0) {
      toast.error("No data to export");
      return;
    }
    const data = sortedCustomers.map((c) => ({
      ID: c.customerId,
      Shop: c.shopName,
      Owner: c.ownerName,
      Phone: c.phone,
      Route: c.route,
      Status: c.status,
      "Outstanding (LKR)": c.outstandingBalance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "customers.xlsx");
  };

  const generatePDF = () => {
    if (sortedCustomers.length === 0) {
      toast.error("No data to export");
      return;
    }
    const doc = new jsPDF();
    doc.text("Customer List", 14, 15);
    autoTable(doc, {
      head: [["ID", "Shop Name", "Phone", "Route", "Status", "Balance"]],
      body: sortedCustomers.map((c) => [
        c.customerId,
        c.shopName,
        c.phone,
        c.route,
        c.status,
        c.outstandingBalance.toLocaleString(),
      ]),
      startY: 20,
    });
    doc.save("customers.pdf");
  };

  useEffect(() => setCurrentPage(1), [searchQuery, routeFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer database and credit details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchCustomers}
            disabled={loading}
            title="Refresh Data"
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
              <DropdownMenuItem onClick={generatePDF}>
                <FileText className="w-4 h-4 mr-2 text-red-600" /> Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Customers
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Credit Outstanding
            </CardTitle>
            <Wallet className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              LKR {totalOutstanding.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {/* Subtract 1 if "all" is included in the count logic above, but here we count unique routes directly */}
              {new Set(customers.map((c) => c.route)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shop, owner or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter Route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "all" ? "All Routes" : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
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
