"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users } from "lucide-react";
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

// Initial Mock Data
const MOCK_USERS: User[] = [
  {
    id: "1",
    fullName: "Admin User",
    username: "admin",
    email: "admin@champiks.com",
    role: "admin",
    status: "Active",
    lastActive: "Just now",
  },
  {
    id: "2",
    fullName: "Kasun Perera",
    username: "kasunp",
    email: "kasun@champiks.com",
    role: "office",
    status: "Active",
    lastActive: "2 hours ago",
  },
  {
    id: "3",
    fullName: "Ajith Bandara",
    username: "ajithb",
    email: "ajith@champiks.com",
    role: "rep",
    status: "Active",
    lastActive: "1 day ago",
  },
  {
    id: "4",
    fullName: "Saman Driver",
    username: "samand",
    email: "saman.d@champiks.com",
    role: "delivery",
    status: "Inactive",
    lastActive: "1 week ago",
  },
  // Add a few more mock users to test pagination if needed
  {
    id: "5",
    fullName: "Nimal Accounts",
    username: "nimala",
    email: "nimal@champiks.com",
    role: "office",
    status: "Active",
    lastActive: "3 hours ago",
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Adjust this number as needed

  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);

  // Form State
  const [formData, setFormData] = useState<UserFormData>({
    fullName: "",
    username: "",
    email: "",
    password: "",
    role: "office",
    status: "Active",
  });

  // Filter Users
  const filteredUsers = users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Handlers
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
      password: "",
      role: user.role,
      status: user.status,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  // --- Status Toggle Handlers ---
  const handleStatusClick = (user: User, checked: boolean) => {
    setSelectedUser(user);
    setPendingStatus(checked);
    setIsStatusDialogOpen(true);
  };

  const confirmStatusChange = () => {
    if (selectedUser && pendingStatus !== null) {
      const newStatus = pendingStatus ? "Active" : "Inactive";

      setUsers(
        users.map((u) =>
          u.id === selectedUser.id ? { ...u, status: newStatus } : u
        )
      );

      toast.success(`User marked as ${newStatus}`);
      setIsStatusDialogOpen(false);
      setSelectedUser(null);
      setPendingStatus(null);
    }
  };

  const handleSaveUser = () => {
    if (!formData.fullName || !formData.username || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!selectedUser && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    if (selectedUser) {
      setUsers(
        users.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                fullName: formData.fullName,
                username: formData.username,
                email: formData.email,
                role: formData.role,
                status: formData.status,
              }
            : u
        )
      );
      toast.success("User updated successfully");
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        lastActive: "Never",
      };
      setUsers([...users, newUser]);
      toast.success("User created successfully");
    }

    setIsAddDialogOpen(false);
  };

  const confirmDelete = () => {
    if (selectedUser) {
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage access and user roles for the system.
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" /> Create User
        </Button>
      </div>

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
          <UserTable
            users={paginatedUsers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusClick}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

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
                {" "}
                {pendingStatus ? "Active" : "Inactive"}
              </span>
              ?
              {!pendingStatus && (
                <span className="block mt-2 text-xs text-muted-foreground">
                  Inactive users will not be able to log in to the system.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsStatusDialogOpen(false);
                setPendingStatus(null);
              }}
            >
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
