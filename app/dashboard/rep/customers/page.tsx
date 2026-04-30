// app/dashboard/rep/customers/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Users,
  MapPin,
  Phone,
  Loader2,
  Wallet,
  Filter,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/TablePagination";

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

const emptyForm = {
  shopName: "",
  ownerName: "",
  phone: "",
  email: "",
  address: "",
  route: "General",
  creditLimit: 0,
};

export default function RepCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [repId, setRepId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add Customer Dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeOptions, setRouteOptions] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState(emptyForm);

  const fetchMyCustomers = async () => {
    try {
      setLoading(true);

      const storedUser = localStorage.getItem("currentUser");
      if (!storedUser) {
        toast.error("User session not found. Please login again.");
        return;
      }

      const userObj = JSON.parse(storedUser);
      let rid = userObj.id;
      let bid = userObj.businessId;

      if (!rid || !bid) {
        const userRes = await fetch("/api/users");
        const users = await userRes.json();
        const me = users.find((u: any) => u.email === userObj.email);
        if (me) {
          if (!rid) rid = me.id;
          if (!bid) bid = me.businessId;
        }
      }

      if (!rid) {
        toast.error("Could not identify sales representative account.");
        return;
      }

      setRepId(rid);
      setBusinessId(bid);

      const res = await fetch(`/api/customers?repId=${rid}`);
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

  useEffect(() => {
    fetchMyCustomers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, routeFilter]);

  // Fetch routes when dialog opens
  useEffect(() => {
    if (!isAddOpen) return;
    fetch("/api/settings/categories?type=route")
      .then((r) => r.json())
      .then(setRouteOptions)
      .catch(console.error);
  }, [isAddOpen]);

  const handleAddCustomer = async () => {
    if (!formData.shopName.trim()) {
      toast.error("Shop name is required.");
      return;
    }
    if (!businessId) {
      toast.error("Business context not found.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          businessId,
          assignedRepId: repId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to create customer.");
        return;
      }
      toast.success("Customer created successfully.");
      setIsAddOpen(false);
      setFormData(emptyForm);
      fetchMyCustomers();
    } catch {
      toast.error("Failed to create customer.");
    } finally {
      setSaving(false);
    }
  };

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
    const matchesRoute = routeFilter === "all" || c.route === routeFilter;

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
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer base and view credit details.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {/* KPI Cards — always 2 columns, even on mobile */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Total Customers
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCustomers} Active shops
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Outstanding
            </CardTitle>
            <Wallet className="w-4 h-4 text-red-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold text-red-600 leading-tight">
              LKR {totalOutstanding.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Credit to collect
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table / Card List Section */}
      <Card>
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shop, name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 md:shrink-0">
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="flex-1 min-w-0 md:w-[150px]">
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <MapPin className="h-4 w-4 shrink-0" />
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 min-w-0 md:w-[140px]">
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Filter className="h-4 w-4 shrink-0" />
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

        <CardContent className="px-3 sm:px-6">
          {/* ── Mobile: Card list (hidden on md+) ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {paginatedCustomers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Users className="h-8 w-8 opacity-50" />
                <p className="text-sm">No customers found matching your filters.</p>
              </div>
            ) : (
              paginatedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-lg border bg-white p-3 shadow-sm space-y-2"
                >
                  {/* Top row: avatar + name + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-9 w-9 bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                        <AvatarFallback className="font-semibold text-xs">
                          {customer.shopName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {customer.shopName}
                        </p>
                        {customer.ownerName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {customer.ownerName}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${getStatusColor(customer.status)}`}
                    >
                      {customer.status}
                    </Badge>
                  </div>

                  {/* Bottom row: phone / route / outstanding */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t">
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {customer.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {customer.route || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={`text-sm font-semibold ${
                          customer.outstandingBalance > 0
                            ? "text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        LKR {customer.outstandingBalance.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Limit: {customer.creditLimit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Desktop: Table (hidden below md) ── */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Details</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outstanding (LKR)</TableHead>
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

          {/* Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredCustomers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {/* Add New Customer Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setFormData(emptyForm);
        }}
      >
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the new customer&apos;s details. They will be assigned to you automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Shop Name */}
            <div className="col-span-2 space-y-2">
              <Label>
                Shop Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.shopName}
                onChange={(e) =>
                  setFormData({ ...formData, shopName: e.target.value })
                }
                placeholder="e.g. Perera Traders - Galle"
              />
            </div>

            {/* Owner Name */}
            <div className="space-y-2">
              <Label>Owner / Contact Person</Label>
              <Input
                value={formData.ownerName}
                onChange={(e) =>
                  setFormData({ ...formData, ownerName: e.target.value })
                }
                placeholder="e.g. Mr. Perera"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label>
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="077xxxxxxx"
              />
            </div>

            {/* Email */}
            <div className="col-span-2 space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="email@example.com"
              />
            </div>

            {/* Address */}
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Full street address"
              />
            </div>

            {/* Route */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Route / Area
              </Label>
              <Select
                value={formData.route}
                onValueChange={(val) =>
                  setFormData({ ...formData, route: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  {routeOptions
                    .filter((r) => r.name !== "General")
                    .map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credit Limit */}
            <div className="space-y-2">
              <Label>Credit Limit (LKR)</Label>
              <Input
                type="number"
                min="0"
                value={formData.creditLimit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    creditLimit: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCustomer} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
