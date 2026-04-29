"use client";

import { useState, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
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
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";

// Import local components and types
import { Customer, SortField, SortOrder, CustomerFormData } from "./types";
import { CustomerTable } from "./_components/CustomerTable";
import { CustomerDialogs } from "./_components/CustomerDialogs";

export default function AgencyCustomersPage() {
  // Initialize business ID synchronously from localStorage
  const [currentBusinessId] = useState<string>(() => {
    const user = getUserBusinessContext();
    return user?.businessId ?? BUSINESS_IDS.ORANGE_AGENCY;
  });

  const {
    data: customers = [],
    loading,
    refetch: fetchCustomers,
  } = useCachedFetch<Customer[]>(
    `/api/customers?businessId=${currentBusinessId}`,
    [],
    () => toast.error("Error loading customer data")
  );

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
    route: "General",
    status: "Active",
    creditLimit: 0,
    businessId: "",
  });

  // Initialize formData with the resolved businessId
  useEffect(() => {
    setFormData((prev) => ({ ...prev, businessId: currentBusinessId }));
  }, [currentBusinessId]);

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
    if (!formData.shopName || !formData.route) {
      toast.error("Please fill required fields (Shop Name, Route)");
      return;
    }

    // Ensure businessId is present
    if (!formData.businessId && currentBusinessId) {
      formData.businessId = currentBusinessId;
    }

    try {
      if (selectedCustomer) {
        // UPDATE
        const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update");
        toast.success("Customer updated successfully");
      } else {
        // CREATE
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
      route: "General",
      status: "Active",
      creditLimit: 0,
      businessId: currentBusinessId || "",
    });
    setSelectedCustomer(null);
  };

  const generateExcel = () => {
    if (sortedCustomers.length === 0) return;
    const data = sortedCustomers.map((c) => ({
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
    XLSX.writeFile(wb, "orange_customers.xlsx");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-orange-900">
            Distributors & Shops
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage distribution customer database
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchCustomers}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={generateExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
            className="bg-orange-600 hover:bg-orange-700"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 px-3 sm:px-6">
          {/* Mobile: search row 1, dropdowns row 2 — Desktop: all one row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Row 1 (mobile) / Left side (desktop): Search */}
            <div className="relative w-full sm:flex-1 sm:min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search shop, owner, phone…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-9 text-sm w-full"
              />
            </div>
            {/* Row 2 (mobile) / Right side (desktop): Dropdowns + count */}
            <div className="flex items-center gap-2">
              <Select value={routeFilter} onValueChange={(v) => { setRouteFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="flex-1 sm:flex-none sm:w-[140px] h-9 text-sm">
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
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="flex-1 sm:flex-none sm:w-[130px] h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                {sortedCustomers.length} found
              </span>
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
                businessId: currentBusinessId || "",
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
