"use client";

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
import { Badge } from "@/components/ui/badge";
import { User, UserFormData, UserStatus } from "../types";
import { UserRole } from "@/app/config/nav-config";
import { Building2, Star, StarOff } from "lucide-react";

interface Business {
  id: string;
  name: string;
}

interface UserDialogsProps {
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  formData: UserFormData;
  setFormData: (data: UserFormData) => void;
  onSave: () => void;
  selectedUser: User | null;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  onDeleteConfirm: () => void;
  businesses: Business[];
}

export function UserDialogs({
  isAddDialogOpen,
  setIsAddDialogOpen,
  formData,
  setFormData,
  onSave,
  selectedUser,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  onDeleteConfirm,
  businesses,
}: UserDialogsProps) {
  const isOffice = formData.role === "office";
  const isRepOrDelivery = formData.role === "rep" || formData.role === "delivery";

  // Toggle a business in the accessible list
  const toggleBusiness = (id: string) => {
    const current = formData.accessibleBusinessIds ?? [];
    const next = current.includes(id)
      ? current.filter((b) => b !== id)
      : [...current, id];

    // If we removed the primary, clear it
    const newPrimary =
      formData.businessId && !next.includes(formData.businessId)
        ? next[0] ?? ""
        : formData.businessId;

    setFormData({
      ...formData,
      accessibleBusinessIds: next,
      businessId: newPrimary,
    });
  };

  // Set a business as primary (must already be checked)
  const setPrimary = (id: string) => {
    setFormData({ ...formData, businessId: id });
  };

  return (
    <>
      {/* ── Create / Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Edit User" : "Create New User"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser
                ? "Update user details and permissions."
                : "Enter details to create a new system user."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Full Name */}
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="e.g. John Doe"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
              />
            </div>

            {/* Username + Role */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="johnd"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      role: val as UserRole,
                      businessId:
                        val === "office" || val === "rep" || val === "delivery"
                          ? formData.businessId
                          : "",
                      accessibleBusinessIds:
                        val === "office"
                          ? formData.accessibleBusinessIds
                          : [],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="office">Office Staff</SelectItem>
                    <SelectItem value="rep">Sales Rep</SelectItem>
                    <SelectItem value="delivery">Delivery Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Business Access (office only) ──────────────────────── */}
            {isOffice && (
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <Label>Business Access</Label>
                  {formData.accessibleBusinessIds?.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {formData.accessibleBusinessIds.length} selected
                    </Badge>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
                  {businesses.map((b) => {
                    const isChecked = (
                      formData.accessibleBusinessIds ?? []
                    ).includes(b.id);
                    const isPrimary = formData.businessId === b.id;

                    return (
                      <div
                        key={b.id}
                        className={`flex items-center justify-between px-3 py-2.5 transition-colors ${
                          isChecked ? "bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        {/* Checkbox + name */}
                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border accent-black cursor-pointer shrink-0"
                            checked={isChecked}
                            onChange={() => toggleBusiness(b.id)}
                          />
                          <span
                            className={`text-sm truncate ${
                              isChecked
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {b.name}
                          </span>
                        </label>

                        {/* Primary toggle — only for checked businesses */}
                        {isChecked && (
                          <button
                            type="button"
                            onClick={() => setPrimary(b.id)}
                            className={`ml-3 flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors shrink-0 ${
                              isPrimary
                                ? "bg-amber-50 border-amber-300 text-amber-700 font-medium"
                                : "border-border text-muted-foreground hover:border-amber-300 hover:text-amber-600"
                            }`}
                            title={
                              isPrimary
                                ? "Primary portal (default on login)"
                                : "Set as primary portal"
                            }
                          >
                            {isPrimary ? (
                              <>
                                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                Primary
                              </>
                            ) : (
                              <>
                                <StarOff className="w-3 h-3" />
                                Set Primary
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {formData.accessibleBusinessIds?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Select at least one business for office staff.
                  </p>
                )}
                {formData.accessibleBusinessIds?.length > 0 &&
                  !formData.businessId && (
                    <p className="text-xs text-amber-600">
                      Mark one business as Primary — it will be the default
                      portal on login.
                    </p>
                  )}
              </div>
            )}

            {/* ── Business (rep / delivery only) ───────────────────────── */}
            {isRepOrDelivery && (
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <Label>Business *</Label>
                </div>
                <Select
                  value={formData.businessId || ""}
                  onValueChange={(val) =>
                    setFormData({ ...formData, businessId: val })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select business" />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@champika.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0771234567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">
                {selectedUser ? "New Password (Optional)" : "Password *"}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={
                  selectedUser
                    ? "Leave blank to keep current"
                    : "Enter strong password"
                }
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Account Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) =>
                  setFormData({ ...formData, status: val as UserStatus })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>
              {selectedUser ? "Update User" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ─────────────────────────────────────────────── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedUser?.fullName}</strong>? This action cannot be
              undone.
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
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
