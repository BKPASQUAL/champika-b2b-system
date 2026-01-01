"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

interface LocationSettingsSheetProps {
  locationId: string;
  locationName: string;
}

export function LocationSettingsSheet({
  locationId,
  locationName,
}: LocationSettingsSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch all active users
      const usersRes = await fetch("/api/users");
      const usersData = await usersRes.json();

      // 2. Fetch currently assigned users for this location
      const accessRes = await fetch(`/api/inventory/${locationId}/access`);
      const accessData = await accessRes.json();

      if (usersRes.ok) setUsers(usersData);
      if (accessRes.ok) setAssignedUserIds(accessData.assignedUserIds || []);
    } catch (error) {
      toast.error("Failed to load user settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, locationId]);

  const handleToggleUser = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/inventory/${locationId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: assignedUserIds }),
      });

      if (!res.ok) throw new Error("Failed to save changes");

      toast.success("Warehouse access updated successfully");
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Warehouse Settings</SheetTitle>
          <SheetDescription>
            Manage access and configuration for {locationName}.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium leading-none">User Access</h3>
            <p className="text-sm text-muted-foreground">
              Select users who can manage stock at this location.
            </p>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="border rounded-md h-[400px] overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {filteredUsers.length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-4">
                        No users found.
                      </p>
                    ) : (
                      filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between space-x-4 p-2 rounded hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <Checkbox
                              id={`user-${user.id}`}
                              checked={assignedUserIds.includes(user.id)}
                              onCheckedChange={() => handleToggleUser(user.id)}
                            />
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {user.fullName?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <label
                                  htmlFor={`user-${user.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {user.fullName}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {user.role} • {user.email}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
