// app/dashboard/office/wireman/customers/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import {
  Download,
  Plus,
  FileSpreadsheet,
  FileText,
  Search,
  RefreshCw,
  Printer,
  Share2,
  Users,
  AlertCircle,
  Wallet,
  CheckCircle2,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BUSINESS_IDS, INTERNAL_CUSTOMERS } from "@/app/config/business-constants";

// Import local components and types
import { Customer, SortField, SortOrder, CustomerFormData } from "./types";
import { CustomerTable } from "./_components/CustomerTable";
import { CustomerDialogs } from "./_components/CustomerDialogs";
import {
  downloadCustomerListPDF,
  printCustomerListReport,
  shareCustomerListSummary,
} from "@/app/lib/customer-list-report";

export default function WiremanCustomersPage() {
  const [currentBusinessId] = useState<string>(BUSINESS_IDS.WIREMAN_AGENCY);

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
  const [balanceFilter, setBalanceFilter] = useState<"all" | "outstanding" | "zero">("all");
  const [sortField, setSortField] = useState<SortField>("shopName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  useEffect(() => {
    setFormData((prev) => ({ ...prev, businessId: currentBusinessId }));
  }, [currentBusinessId]);

  // Derived Data
  const routes = ["all", ...Array.from(new Set(customers.map((c) => c.route || "General")))];

  // KPI Calculations
  const totalCustomersCount = customers.length;
  const activeCustomersCount = customers.filter((c) => c.status === "Active").length;
  const customersWithBalance = customers.filter((c) => (c.outstandingBalance || 0) > 0);
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);

  // Filter & Sort
  const filteredCustomers = customers.filter((customer) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      customer.shopName.toLowerCase().includes(searchLower) ||
      (customer.ownerName && customer.ownerName.toLowerCase().includes(searchLower)) ||
      (customer.phone && customer.phone.includes(searchQuery));
    const matchesRoute =
      routeFilter === "all" || customer.route === routeFilter;
    const matchesStatus =
      statusFilter === "all" || customer.status === statusFilter;
    const matchesBalance =
      balanceFilter === "all"
        ? true
        : balanceFilter === "outstanding"
        ? (customer.outstandingBalance || 0) > 0
        : (customer.outstandingBalance || 0) <= 0;

    return matchesSearch && matchesRoute && matchesStatus && matchesBalance;
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

  const getReportPayload = () => {
    const listToExport = sortedCustomers.map((c) => ({
      id: c.id,
      shopName: c.shopName,
      ownerName: c.ownerName,
      phone: c.phone,
      route: c.route,
      status: c.status,
      creditLimit: c.creditLimit,
      outstandingBalance: c.outstandingBalance,
      isPinned: INTERNAL_CUSTOMERS.includes(c.shopName),
    }));

    const filterText = [
      routeFilter !== "all" ? `Route: ${routeFilter}` : null,
      statusFilter !== "all" ? `Status: ${statusFilter}` : null,
      balanceFilter !== "all" ? `Balance: ${balanceFilter}` : null,
      searchQuery ? `Search: "${searchQuery}"` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      agencyName: "Wireman Distributors",
      customers: listToExport,
      filterInfo: filterText || "All Records",
      primaryColor: [153, 27, 27] as [number, number, number], // Red-800
    };
  };

  const handleExportPDF = () => {
    if (sortedCustomers.length === 0) {
      return toast.error("No customer records to export");
    }
    downloadCustomerListPDF(getReportPayload());
  };

  const handlePrintReport = () => {
    if (sortedCustomers.length === 0) {
      return toast.error("No customer records to print");
    }
    printCustomerListReport(getReportPayload());
  };

  const handleShareWhatsApp = () => {
    if (sortedCustomers.length === 0) {
      return toast.error("No customer records to share");
    }
    shareCustomerListSummary(getReportPayload());
  };

  const generateExcel = () => {
    if (sortedCustomers.length === 0) return toast.error("No customer records to export");
    const data = sortedCustomers.map((c) => ({
      Shop: c.shopName,
      Owner: c.ownerName || "",
      Phone: c.phone || "",
      Route: c.route || "General",
      Address: c.address || "",
      Status: c.status || "Active",
      "Credit Limit (LKR)": c.creditLimit || 0,
      "Outstanding (LKR)": c.outstandingBalance || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Wireman Customers");
    XLSX.writeFile(wb, "wireman_customers.xlsx");
    toast.success("Excel exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-900">
            Wireman Distributors
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage Wireman customer database, outstanding balances & statements
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchCustomers}
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {/* Quick Print Button */}
          <Button
            variant="outline"
            onClick={handlePrintReport}
            disabled={loading || sortedCustomers.length === 0}
            title="Print Customer List"
          >
            <Printer className="w-4 h-4 mr-2 text-slate-700" /> Print
          </Button>

          {/* Quick Share Button */}
          <Button
            variant="outline"
            onClick={handleShareWhatsApp}
            disabled={loading || sortedCustomers.length === 0}
            title="Share Outstanding Summary on WhatsApp"
          >
            <Share2 className="w-4 h-4 mr-2 text-green-600" /> Share
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2 text-red-700" /> Export & Reports
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="w-4 h-4 mr-2 text-red-600" />
                Export PDF Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={generateExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                Export Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrintReport}>
                <Printer className="w-4 h-4 mr-2 text-blue-600" />
                Print List Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareWhatsApp}>
                <Share2 className="w-4 h-4 mr-2 text-emerald-600" />
                Share WhatsApp Summary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Customer Button */}
          <Button
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Customers */}
        <Card className="border-red-100 shadow-sm bg-gradient-to-br from-white to-red-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Customers
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {totalCustomersCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {activeCustomersCount} Active
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-700">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Outstanding */}
        <Card className="border-red-200 shadow-sm bg-gradient-to-br from-red-50 to-red-100/40 col-span-1 md:col-span-2">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                Total Customer Outstanding
              </p>
              <h3 className="text-2xl font-black text-red-700 mt-1">
                LKR {totalOutstanding.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-red-600/80 font-medium mt-0.5">
                Across {customersWithBalance.length} customers with pending balance
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Customers Count */}
        <Card
          className={`cursor-pointer transition-all border shadow-sm ${
            balanceFilter === "outstanding"
              ? "border-red-500 bg-red-50 ring-2 ring-red-500/20"
              : "border-slate-200 hover:border-red-300"
          }`}
          onClick={() =>
            setBalanceFilter((prev) => (prev === "outstanding" ? "all" : "outstanding"))
          }
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                With Outstanding
              </p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">
                {customersWithBalance.length}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {balanceFilter === "outstanding" ? "Filtering active (Click to reset)" : "Click to view outs only"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shop, owner, phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Filter Selects */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Route Filter */}
              <Select
                value={routeFilter}
                onValueChange={(val) => {
                  setRouteFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
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

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>

              {/* Balance Filter */}
              <Select
                value={balanceFilter}
                onValueChange={(val: any) => {
                  setBalanceFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Balance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Balances</SelectItem>
                  <SelectItem value="outstanding">With Outstanding (&gt; 0)</SelectItem>
                  <SelectItem value="zero">Zero / Settled (0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
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
            agencyTitle="Wireman Distributors"
          />
        </CardContent>
      </Card>

      {/* Customer Create/Edit & Delete Dialogs */}
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
