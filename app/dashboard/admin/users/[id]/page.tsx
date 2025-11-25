// app/dashboard/admin/users/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Activity,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  table_name: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_at: string;
  new_data: any;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function ViewUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch User Details
        const userRes = await fetch(`/api/users/${userId}`);
        if (!userRes.ok) throw new Error("Failed to fetch user");
        const userData = await userRes.json();
        setUser(userData);

        // 2. Fetch User Activity
        const activityRes = await fetch(`/api/users/${userId}/activity`);
        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setActivities(activityData);
        }
      } catch (error) {
        toast.error("Error loading user data");
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchData();
  }, [userId]);

  // Filtering Logic
  const filteredActivities = activities.filter((log) => {
    const matchesSearch =
      log.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.id.includes(searchQuery);
    const matchesAction = actionFilter === "ALL" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT":
        return "bg-green-100 text-green-800 border-green-200";
      case "UPDATE":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "DELETE":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return <div className="p-8 text-center text-red-500">User not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">User Profile</h1>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {user.full_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-xl">{user.full_name}</CardTitle>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Mail className="w-4 h-4" /> {user.email}
                </div>
              </div>
            </div>
            <Badge variant={user.is_active ? "default" : "destructive"}>
              {user.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/20">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase">
                Role
              </span>
              <span className="font-medium capitalize">{user.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/20">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase">
                User ID
              </span>
              <span className="font-mono text-sm">{user.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" /> Activity History
            </CardTitle>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search table or ID..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  <SelectItem value="INSERT">Creates</SelectItem>
                  <SelectItem value="UPDATE">Updates</SelectItem>
                  <SelectItem value="DELETE">Deletes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity / Table</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No activities found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActivities.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getActionColor(log.action)}
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium font-mono text-sm">
                        {log.table_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.changed_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        ID: {log.id.substring(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
