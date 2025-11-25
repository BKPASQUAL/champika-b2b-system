"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, UserFormData } from "./types";
import { UserTable } from "./_components/UserTable";
import { UserDialogs } from "./_components/UserDialogs";
import { toast } from "sonner";
import { useRouter } from "next/navigation"; // Import router

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);
  const router = useRouter();

  const handleViewUser = (user: User) => {
    router.push(`/dashboard/admin/users/${user.id}`);
  };
  // Form State
  const [formData, setFormData] = useState<UserFormData>({
    fullName: "",
    username: "",
    email: "",
    password: "",
    role: "office",
    status: "Active",
  });

  // --- 1. FETCH USERS ---
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- 2. FILTERING ---
  const filteredUsers = users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // --- 3. ACTION HANDLERS ---

  const handleAddNew = () => {
    setSelectedUser(null);
    setFormData({
      fullName: "",
      username: "",
      email: "",
      password: "",
      role: "office",
      status: "Active",
    });
    setIsAddDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      password: "", // Keep blank unless changing
      role: user.role,
      status: user.status,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  // --- 4. API INTEGRATION ---

  const handleSaveUser = async () => {
    // Simple Validation
    if (!formData.fullName || !formData.username || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!selectedUser && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    try {
      let response;
      if (selectedUser) {
        // UPDATE
        response = await fetch(`/api/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        // CREATE
        response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Operation failed");

      toast.success(selectedUser ? "User updated!" : "User created!");
      setIsAddDialogOpen(false);
      fetchUsers(); // Refresh List
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || "Delete failed");
      }
      toast.success("User deleted");
      setIsDeleteDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Status Switch Logic
  const handleStatusClick = (user: User, checked: boolean) => {
    setSelectedUser(user);
    setPendingStatus(checked);
    setIsStatusDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (selectedUser && pendingStatus !== null) {
      try {
        const response = await fetch(`/api/users/${selectedUser.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: pendingStatus }),
        });

        if (!response.ok) throw new Error("Status update failed");

        const newStatus = pendingStatus ? "Active" : "Inactive";
        toast.success(`User marked as ${newStatus}`);

        // Optimistic Update
        setUsers(
          users.map((u) =>
            u.id === selectedUser.id ? { ...u, status: newStatus } : u
          )
        );
      } catch (error) {
        toast.error("Failed to update status");
      } finally {
        setIsStatusDialogOpen(false);
        setPendingStatus(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Users</h1>
          <p className="text-muted-foreground mt-1">Manage access and roles.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchUsers}
            title="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button onClick={handleAddNew}>
            <Plus className="w-4 h-4 mr-2" /> Create User
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Users className="w-5 h-5" /> All Users
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <UserTable
              users={paginatedUsers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusClick}
              onView={handleViewUser} // Pass the handler here
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UserDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSaveUser}
        selectedUser={selectedUser}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={confirmDelete}
      />

      {/* Status Confirmation Alert */}
      <AlertDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Status?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark{" "}
              <strong>{selectedUser?.fullName}</strong> as
              <span
                className={
                  pendingStatus
                    ? "text-green-600 font-bold"
                    : "text-red-600 font-bold"
                }
              >
                {pendingStatus ? " Active" : " Inactive"}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
