// app/dashboard/office/wireman/customers/_components/CustomerDialogs.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { Customer, CustomerFormData, CustomerStatus } from "../types";

interface CustomerDialogsProps {
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  formData: CustomerFormData;
  setFormData: (data: CustomerFormData) => void;
  onSave: () => void;
  selectedCustomer: Customer | null;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  onDeleteConfirm: () => void;
}

export function CustomerDialogs({
  isAddDialogOpen,
  setIsAddDialogOpen,
  formData,
  setFormData,
  onSave,
  selectedCustomer,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  onDeleteConfirm,
}: CustomerDialogsProps) {
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAddDialogOpen) return;
      try {
        setLoading(true);
        // Fetch routes for dropdown
        const routesRes = await fetch("/api/settings/categories?type=route");
        if (routesRes.ok) setRoutes(await routesRes.json());
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAddDialogOpen]);

  return (
    <>
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer
                ? "Update customer details."
                : "Enter new customer information below."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Shop Name */}
            <div className="col-span-2 space-y-2">
              <Label>Shop Name *</Label>
              <Input
                value={formData.shopName}
                onChange={(e) =>
                  setFormData({ ...formData, shopName: e.target.value })
                }
                placeholder="e.g. Wireman Electricals - Kandy"
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
              <Label>Phone Number *</Label>
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
                placeholder="Full Street address"
              />
            </div>

            {/* Route Dropdown */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Route / Area *
              </Label>
              <Select
                value={formData.route}
                onValueChange={(val) =>
                  setFormData({ ...formData, route: val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={loading ? "Loading..." : "Select Route"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {routes.length === 0 && !loading && (
                    <SelectItem value="General">General (Default)</SelectItem>
                  )}
                  {routes.map((r) => (
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

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  setFormData({ ...formData, status: v as CustomerStatus })
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            {/* Red Theme Button */}
            <Button
              onClick={onSave}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {selectedCustomer ? "Update Customer" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedCustomer?.shopName}</strong>? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteConfirm}>
              Delete Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
