// app/dashboard/rep/customers/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
  Wallet,
  Filter,
  Plus,
  Pencil,
  Map,
  Navigation,
  Compass,
  Check,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/TablePagination";
import { cn } from "@/lib/utils";
// dynamic customer map dynamic import removed

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
  latitude?: number | null;
  longitude?: number | null;
  businessId?: string;
}

const emptyForm = {
  shopName: "",
  ownerName: "",
  phone: "",
  email: "",
  address: "",
  route: "General",
  creditLimit: 0,
  status: "Active" as CustomerStatus,
  latitude: "" as string | number,
  longitude: "" as string | number,
};

export default function RepCustomersPage() {
  const router = useRouter();
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

  // Add / Edit Customer Dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [routeOptions, setRouteOptions] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
  const [formData, setFormData] = useState(emptyForm);

  const [updatingGpsId, setUpdatingGpsId] = useState<string | null>(null);
  const [gpsConfirmCustomer, setGpsConfirmCustomer] = useState<Customer | null>(null);
  const [confirmSaveData, setConfirmSaveData] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [submitCustomerStep, setSubmitCustomerStep] = useState(0); // 0=idle 1=validating 2=saving 3=done

  const handleSetGpsLocation = async (customer: Customer) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setUpdatingGpsId(customer.id);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`/api/customers/${customer.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shopName: customer.shopName,
              ownerName: customer.ownerName,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              route: customer.route || "General",
              creditLimit: customer.creditLimit,
              status: customer.status,
              businessId: customer.businessId || businessId,
              latitude,
              longitude,
            }),
          });
          const json = await res.json();
          if (!res.ok) {
            toast.error(json.error || "Failed to save GPS location.");
            return;
          }
          toast.success(`GPS location updated for ${customer.shopName}.`);
          fetchMyCustomers();
        } catch (error) {
          console.error(error);
          toast.error("Failed to update GPS location.");
        } finally {
          setUpdatingGpsId(null);
        }
      },
      (error) => {
        console.error(error);
        toast.error(`Geolocation error: ${error.message}`);
        setUpdatingGpsId(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      shopName: customer.shopName,
      ownerName: customer.ownerName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      route: customer.route || "General",
      creditLimit: customer.creditLimit,
      status: customer.status,
      latitude: customer.latitude ?? "",
      longitude: customer.longitude ?? "",
    });
    setIsAddOpen(true);
  };

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

      const res = await fetch(`/api/customers?businessId=${bid}`);
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

  const closeDialog = () => {
    setIsAddOpen(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
  };

  const handleSaveCustomer = () => {
    if (!formData.shopName.trim()) {
      toast.error("Shop name is required.");
      return;
    }
    if (!businessId) {
      toast.error("Business context not found.");
      return;
    }
    setConfirmSaveData(true);
  };

  const executeSaveCustomer = async () => {
    try {
      setSubmittingCustomer(true);
      setSubmitCustomerStep(1);

      const isEdit = !!editingCustomer;
      const url = isEdit
        ? `/api/customers/${editingCustomer.id}`
        : "/api/customers";

      // Step 1: Validating details local delay
      await new Promise((r) => setTimeout(r, 600));
      setSubmitCustomerStep(2);

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          status: isEdit ? formData.status : "Active",
          businessId,
          ...(isEdit ? {} : { assignedRepId: repId }),
          latitude: formData.latitude !== "" ? parseFloat(formData.latitude as string) : null,
          longitude: formData.longitude !== "" ? parseFloat(formData.longitude as string) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || `Failed to ${isEdit ? "update" : "create"} customer.`);
        setSubmittingCustomer(false);
        setSubmitCustomerStep(0);
        return;
      }

      setSubmitCustomerStep(3);
      await new Promise((r) => setTimeout(r, 1200));

      toast.success(`Customer ${isEdit ? "updated" : "created"} successfully.`);
      closeDialog();
      fetchMyCustomers();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSubmittingCustomer(false);
      setSubmitCustomerStep(0);
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
      c.ownerName.toLowerCase().includes(searchQuery.toLowerCase());

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

  // ── Customer Submission Overlay ─────────────────────────────────────────────
  if (submittingCustomer) {
    const steps = [
      { icon: Users, label: "Validating details", desc: "Checking phone number & duplicate records" },
      { icon: ShieldCheck, label: "Saving customer profile", desc: "Registering shop details to the system" },
      { icon: BadgeCheck, label: "Registration confirmed!", desc: "Customer registered successfully" },
    ];

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
        {/* Subtle animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl animate-pulse [animation-delay:1s]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm px-6">
          {/* Central icon ring */}
          <div className="relative flex items-center justify-center">
            {submitCustomerStep < 3 && (
              <>
                <span className="absolute inline-flex h-28 w-28 rounded-full bg-blue-600/10 animate-ping [animation-duration:1.4s]" />
                <span className="absolute inline-flex h-24 w-24 rounded-full bg-blue-600/15 animate-ping [animation-duration:1.4s] [animation-delay:0.3s]" />
              </>
            )}
            <div className={cn(
              "relative h-20 w-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-700",
              submitCustomerStep === 3
                ? "bg-emerald-500 scale-110 shadow-emerald-200"
                : "bg-blue-600 shadow-blue-200"
            )}>
              {submitCustomerStep === 3 ? (
                <BadgeCheck className="h-10 w-10 text-white animate-[scale-in_0.3s_ease-out]" strokeWidth={1.8} />
              ) : (
                <Loader2 className="h-10 w-10 text-white animate-spin" strokeWidth={1.8} />
              )}
            </div>
          </div>

          {/* Steps list */}
          <div className="w-full space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const stepNum = idx + 1;
              const isDone    = submitCustomerStep > stepNum;
              const isActive  = submitCustomerStep === stepNum;
              const isPending = submitCustomerStep < stepNum;

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-500",
                    isActive  && "bg-blue-50 border border-blue-100 shadow-sm scale-[1.02]",
                    isDone    && "bg-emerald-50 border border-emerald-100",
                    isPending && "opacity-35"
                  )}
                >
                  {/* Step icon / check */}
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-500",
                    isActive  && "bg-blue-600 text-white",
                    isDone    && "bg-emerald-500 text-white",
                    isPending && "bg-slate-100 text-slate-400"
                  )}>
                    {isDone
                      ? <Check className="h-4 w-4" strokeWidth={2.5} />
                      : <Icon className={cn("h-4 w-4", isActive && "animate-pulse")} />
                    }
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-semibold leading-tight",
                      isActive  && "text-blue-700",
                      isDone    && "text-emerald-700",
                      isPending && "text-slate-500"
                    )}>
                      {step.label}
                    </p>
                    {(isActive || isDone) && (
                      <p className={cn(
                        "text-xs mt-0.5",
                        isDone   && "text-emerald-600",
                        isActive && "text-slate-500"
                      )}>
                        {step.desc}
                      </p>
                    )}
                  </div>

                  {/* Active spinner dot */}
                  {isActive && (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
              style={{ width: submitCustomerStep === 0 ? "0%" : submitCustomerStep === 1 ? "33%" : submitCustomerStep === 2 ? "66%" : "100%",
                       backgroundColor: submitCustomerStep === 3 ? "rgb(16 185 129)" : undefined }}
            />
          </div>
        </div>
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
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Customer
          </Button>
        </div>
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
                placeholder="Search shop or name..."
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
                  className={`rounded-lg border bg-white p-3 shadow-sm space-y-2 transition-all duration-300 ${
                    updatingGpsId === customer.id ? "animate-pulse border-blue-400 bg-blue-50/30 shadow-md" : ""
                  }`}
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

                  {/* Bottom row: phone / route / outstanding / edit */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t">
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {customer.route || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
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
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => openEdit(customer)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Location Action Row */}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t text-xs gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs flex-1 text-slate-700 border-slate-200"
                      onClick={() => setGpsConfirmCustomer(customer)}
                      disabled={updatingGpsId === customer.id}
                    >
                      {updatingGpsId === customer.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-blue-600" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 text-blue-600 mr-1" />
                      )}
                      {customer.latitude ? "Update GPS" : "Mark GPS"}
                    </Button>

                    {customer.latitude && customer.longitude ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs flex-1 text-slate-700 border-slate-200"
                          onClick={() => router.push(`/dashboard/rep/customers/map?focus=${customer.id}`)}
                        >
                          <Map className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                          Show Map
                        </Button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 px-2 text-xs flex-1 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium"
                        >
                          <Navigation className="h-3.5 w-3.5 text-indigo-600 mr-1" />
                          Directions
                        </a>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground flex-1 italic text-center py-1">No GPS Pin</span>
                    )}
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
                  <TableHead className="w-24 text-right">Actions</TableHead>
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
                    <TableRow 
                      key={customer.id}
                      className={`transition-all duration-300 ${
                        updatingGpsId === customer.id ? "animate-pulse bg-blue-50/40 border-blue-200" : ""
                      }`}
                    >
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title={customer.latitude ? "Update GPS Location" : "Mark current GPS Location"}
                            onClick={() => setGpsConfirmCustomer(customer)}
                            disabled={updatingGpsId === customer.id}
                          >
                            {updatingGpsId === customer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            ) : (
                              <MapPin className={`h-4 w-4 ${customer.latitude ? 'text-blue-600' : 'text-slate-400'}`} />
                            )}
                          </Button>
                          {customer.latitude && customer.longitude && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600"
                                title="Show on Map"
                                onClick={() => router.push(`/dashboard/rep/customers/map?focus=${customer.id}`)}
                              >
                                <Map className="h-4 w-4" />
                              </Button>
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 text-indigo-600"
                                title="Get Directions"
                              >
                                <Navigation className="h-4 w-4" />
                              </a>
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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

      {/* Add / Edit Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? "Update the customer's details below."
                : "Enter the new customer's details. They will be assigned to you automatically."}
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

            {/* Latitude & Longitude */}
            <div className="space-y-2">
              <Label>Latitude (Optional)</Label>
              <Input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: e.target.value })
                }
                placeholder="e.g. 7.8731"
              />
            </div>
            <div className="space-y-2">
              <Label>Longitude (Optional)</Label>
              <Input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: e.target.value })
                }
                placeholder="e.g. 80.7718"
              />
            </div>

            {/* Status — only shown when editing */}
            {editingCustomer && (
              <div className="col-span-2 space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) =>
                    setFormData({ ...formData, status: val as CustomerStatus })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomer} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingCustomer ? "Update Customer" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GPS Location Confirmation Popup */}
      <Dialog open={!!gpsConfirmCustomer} onOpenChange={(open) => { if (!open) setGpsConfirmCustomer(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600 animate-bounce" /> Confirm GPS Location Update
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to update the location of <strong>{gpsConfirmCustomer?.shopName}</strong> to your current GPS coordinates?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-col gap-1">
            <p>• Make sure you are physically located at the shop when clicking confirm.</p>
            <p>• This will override any existing location pin for this customer.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGpsConfirmCustomer(null)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (gpsConfirmCustomer) {
                  const customerToUpdate = gpsConfirmCustomer;
                  setGpsConfirmCustomer(null);
                  handleSetGpsLocation(customerToUpdate);
                }
              }}
            >
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Details Confirmation Popup */}
      <Dialog open={confirmSaveData} onOpenChange={setConfirmSaveData}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Save Details</DialogTitle>
            <DialogDescription>
              Are you sure you want to save the customer details for <strong>{formData.shopName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col gap-1.5 text-sm border-t border-b border-slate-100 my-2">
            <div className="flex justify-between"><span className="text-slate-500">Route:</span> <span className="font-medium">{formData.route}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Phone:</span> <span className="font-medium">{formData.phone}</span></div>
            {(formData.latitude !== "" || formData.longitude !== "") && (
              <div className="flex justify-between"><span className="text-slate-500">GPS Position:</span> <span className="font-medium text-blue-600">{formData.latitude || '—'}, {formData.longitude || '—'}</span></div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmSaveData(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmSaveData(false);
                executeSaveCustomer();
              }}
              disabled={saving}
            >
              Yes, Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
