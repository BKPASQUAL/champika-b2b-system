// app/dashboard/admin/customers/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  X,
  Download,
  Plus,
  FileSpreadsheet,
  FileText,
  Search,
  Users,
  TrendingUp,
  Wallet,
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

import { Customer, SortField, SortOrder, CustomerFormData } from "./types";
import { CustomerTable } from "./_components/CustomerTable";
import { CustomerDialogs } from "./_components/CustomerDialogs";

// Mock Data
const initialMockCustomers: Customer[] = [
  {
    id: "C-001",
    customerId: "CUS-1001",
    shopName: "Saman Electronics",
    ownerName: "Saman Kumara",
    phone: "077 123 4567",
    email: "saman@gmail.com",
    address: "No 12, Main St, Galle",
    route: "Galle Town",
    status: "Active",
    creditLimit: 100000,
    outstandingBalance: 25000,
    lastOrderDate: "2023-11-15",
    totalOrders: 12,
  },
  {
    id: "C-002",
    customerId: "CUS-1002",
    shopName: "City Hardware",
    ownerName: "Nimal Perera",
    phone: "071 987 6543",
    email: "cityhw@yahoo.com",
    address: "Matara Rd, Ahangama",
    route: "Ahangama",
    status: "Active",
    creditLimit: 200000,
    outstandingBalance: 154000,
    lastOrderDate: "2023-11-18",
    totalOrders: 45,
  },
  {
    id: "C-003",
    customerId: "CUS-1003",
    shopName: "Lanka Traders",
    ownerName: "Kamal Silva",
    phone: "076 555 4444",
    email: "",
    address: "Temple Rd, Unawatuna",
    route: "Unawatuna",
    status: "Blocked",
    creditLimit: 50000,
    outstandingBalance: 62000,
    lastOrderDate: "2023-10-01",
    totalOrders: 8,
  },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(initialMockCustomers);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sort & Pagination
  const [sortField, setSortField] = useState<SortField>("shopName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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

  // Derived Data
  const routes = ["all", ...new Set(customers.map((c) => c.route))];
  const totalOutstanding = customers.reduce(
    (sum, c) => sum + c.outstandingBalance,
    0
  );

  // Logic
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

  // Actions
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSaveCustomer = () => {
    if (!formData.shopName || !formData.phone) {
      alert("Please fill required fields");
      return;
    }

    if (selectedCustomer) {
      setCustomers(
        customers.map((c) =>
          c.id === selectedCustomer.id ? { ...c, ...formData } : c
        )
      );
      setSuccessMessage("Customer updated successfully!");
    } else {
      setCustomers([
        ...customers,
        {
          id: `C-${Date.now()}`,
          customerId: `CUS-${1000 + customers.length + 1}`,
          ...formData,
          outstandingBalance: 0,
          lastOrderDate: "-",
          totalOrders: 0,
        },
      ]);
      setSuccessMessage("Customer added successfully!");
    }
    setIsAddDialogOpen(false);
    resetForm();
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const handleDeleteConfirm = () => {
    if (selectedCustomer) {
      setCustomers(customers.filter((c) => c.id !== selectedCustomer.id));
      setIsDeleteDialogOpen(false);
      setSuccessMessage("Customer deleted!");
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
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

  useEffect(() => setCurrentPage(1), [searchQuery, routeFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {showSuccessAlert && (
        <div className="fixed top-4 right-4 z-50 w-96 animate-in slide-in-from-right">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success!</AlertTitle>
            <AlertDescription className="text-green-700">
              {successMessage}
            </AlertDescription>
            <button
              onClick={() => setShowSuccessAlert(false)}
              className="absolute top-2 right-2 p-1 hover:bg-green-100 rounded"
            >
              <X className="h-4 w-4 text-green-600" />
            </button>
          </Alert>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer database and credit details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Reports
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />{" "}
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem>
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
              {routes.length - 1}
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
              setFormData(c);
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
