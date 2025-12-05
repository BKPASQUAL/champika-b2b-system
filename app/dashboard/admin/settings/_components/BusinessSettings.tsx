"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Building2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface Business {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export function BusinessSettings() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/business");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setBusinesses(data);
    } catch (error) {
      toast.error("Failed to load businesses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error("Business name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/settings/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) throw new Error("Failed to create");

      toast.success("Business added successfully");
      setName("");
      setDescription("");
      fetchBusinesses();
    } catch (error) {
      toast.error("Failed to add business");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this business?")) return;

    try {
      const res = await fetch(`/api/settings/business?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Business deleted");
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      toast.error("Failed to delete business");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Left Column: Add Form */}
      <Card className="md:col-span-1 h-fit">
        <CardHeader>
          <CardTitle>Add Business</CardTitle>
          <CardDescription>
            Register a new business entity for your customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bus-name">
              Business Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="bus-name"
                placeholder="e.g. Retail, Wholesale..."
                className="pl-9"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bus-desc">Description (Optional)</Label>
            <Input
              id="bus-desc"
              placeholder="Short description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleAdd} disabled={submitting}>
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Business
          </Button>
        </CardContent>
      </Card>

      {/* Right Column: List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Business List</CardTitle>
          <CardDescription>
            Manage your registered business types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : businesses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-medium">No Businesses Found</h3>
              <p className="text-sm text-muted-foreground">
                Add your first business using the form.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses.map((business) => (
                    <TableRow key={business.id}>
                      <TableCell className="font-medium">
                        {business.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {business.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(business.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
