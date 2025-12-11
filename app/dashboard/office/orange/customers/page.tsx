// app/dashboard/office/orange/customers/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Plus,
  Search,
  MapPin,
  Phone,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

// --- Types ---
interface AgencyCustomer {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  route: string;
  status: "Active" | "Inactive";
  businessId: string;
}

export default function AgencyCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<AgencyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(
    null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<AgencyCustomer | null>(
    null
  );

  // Form Data
  const [formData, setFormData] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    address: "",
    route: "Main Route",
  });

  // --- Helper: Get Auth Token ---
  const getAuthToken = () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        try {
          const data = JSON.parse(stored);
          return data.accessToken;
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  };

  // --- Fetch Data ---
  const fetchCustomers = useCallback(async () => {
    const user = getUserBusinessContext();
    if (!user || !user.businessId) return;
    setCurrentBusinessId(user.businessId);

    try {
      setLoading(true);
      const res = await fetch(`/api/customers?businessId=${user.businessId}`);

      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();

      setCustomers(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load customer list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // --- Handlers ---
  const handleSave = async () => {
    if (!formData.shopName || !formData.phone) {
      toast.error("Shop Name and Phone are required");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast.error("Session expired. Please log in again.");
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: "Active",
      };

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      let res;
      if (editingCustomer) {
        // Update
        res = await fetch(`/api/customers/${editingCustomer.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        // Create
        res = await fetch("/api/customers", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      }

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || "Operation failed");
      }

      toast.success(editingCustomer ? "Customer updated" : "Customer created");
      setIsDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Customer deleted");
      fetchCustomers();
    } catch (error) {
      toast.error("Could not delete customer");
    }
  };

  const resetForm = () => {
    setFormData({
      shopName: "",
      ownerName: "",
      phone: "",
      address: "",
      route: "Main Route",
    });
    setEditingCustomer(null);
  };

  const handleExport = () => {
    const data = customers.map((c) => ({
      "Shop Name": c.shopName,
      Owner: c.ownerName,
      Phone: c.phone,
      Address: c.address,
      Route: c.route,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "Distribution_Customers.xlsx");
  };

  // --- Rendering ---
  const filteredCustomers = customers.filter(
    (c) =>
      c.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Distributors & Shops
          </h1>
          <p className="text-gray-500">
            Manage your distribution customer base
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search shops or phone numbers..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop Details</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location / Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-gray-500"
                    >
                      No customers found. Add your first shop.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="font-medium">{customer.shopName}</div>
                        <div className="text-xs text-gray-500">
                          {customer.ownerName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-3 w-3" /> {customer.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          {customer.address || "No address"}
                        </div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {customer.route}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700 hover:bg-green-100"
                        >
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingCustomer(customer);
                                setFormData({
                                  shopName: customer.shopName,
                                  ownerName: customer.ownerName,
                                  phone: customer.phone,
                                  address: customer.address,
                                  route: customer.route,
                                });
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(customer.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Shop" : "Add New Shop"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Shop Name *</Label>
              <Input
                value={formData.shopName}
                onChange={(e) =>
                  setFormData({ ...formData, shopName: e.target.value })
                }
                placeholder="e.g. Orange Mart"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Owner Name</Label>
                <Input
                  value={formData.ownerName}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerName: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone Number *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="077..."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Distribution Route</Label>
              <Input
                value={formData.route}
                onChange={(e) =>
                  setFormData({ ...formData, route: e.target.value })
                }
                placeholder="e.g. Galle Road"
              />
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? "Saving..." : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
