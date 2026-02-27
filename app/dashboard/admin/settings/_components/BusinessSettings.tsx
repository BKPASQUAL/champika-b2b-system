"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Building2, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

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

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false, id: null, name: "",
  });

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
    } catch {
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
    } catch {
      toast.error("Failed to add business");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      const res = await fetch(`/api/settings/business?id=${deleteDialog.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Business deleted");
      setBusinesses((prev) => prev.filter((b) => b.id !== deleteDialog.id));
      setDeleteDialog({ open: false, id: null, name: "" });
    } catch {
      toast.error("Failed to delete business");
    }
  };

  return (
    <>
      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Business?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{deleteDialog.name}&quot;</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Business Entities</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Register and manage your business types</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
            {businesses.length} registered
          </Badge>
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column: Add Form */}
          <Card className="md:col-span-1 h-fit border-amber-100 shadow-sm">
            <CardHeader className="pb-4 bg-amber-50/50 rounded-t-xl">
              <CardTitle className="text-base text-amber-800">Add New Business</CardTitle>
              <CardDescription>Register a new business entity for your customers.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bus-name" className="text-sm font-semibold">
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
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bus-desc" className="text-sm font-semibold">Description <span className="text-xs text-muted-foreground font-normal">(Optional)</span></Label>
                <Input
                  id="bus-desc"
                  placeholder="Short description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2" onClick={handleAdd} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Business
              </Button>
            </CardContent>
          </Card>

          {/* Right Column: List */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Registered Businesses</CardTitle>
              <CardDescription>Manage your business types below.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : businesses.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl border-amber-200 bg-amber-50/30">
                  <Building2 className="h-10 w-10 text-amber-400 mx-auto mb-3 opacity-70" />
                  <h3 className="text-base font-semibold text-gray-700">No Businesses Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Add your first business using the form.</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businesses.map((business) => (
                        <TableRow key={business.id} className="hover:bg-amber-50/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                              </div>
                              <span className="font-semibold text-gray-800">{business.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{business.description || "—"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteDialog({ open: true, id: business.id, name: business.name })}
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
      </div>
    </>
  );
}
