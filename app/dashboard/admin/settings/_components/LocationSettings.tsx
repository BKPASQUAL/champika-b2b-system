"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  MapPin,
  Loader2,
  Store,
  Building2,
  CheckCircle2,
  Warehouse,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Location {
  id: string;
  name: string;
  business_id: string | null;
  businessName: string;
  isMain: boolean;
}

interface Business {
  id: string;
  name: string;
}

export function LocationSettings() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false, id: null, name: "",
  });

  // Form State
  const [name, setName] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [isMainWarehouse, setIsMainWarehouse] = useState(false);

  const mainWarehouseExists = locations.some((l) => l.isMain);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [locRes, busRes] = await Promise.all([
        fetch("/api/settings/locations"),
        fetch("/api/settings/business"),
      ]);
      if (locRes.ok) setLocations(await locRes.json());
      if (busRes.ok) setBusinesses(await busRes.json());
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMainCheckChange = (checked: boolean) => {
    setIsMainWarehouse(checked);
    if (checked) {
      setName("Main Warehouse");
      setSelectedBusiness("");
    } else {
      setName("");
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) { toast.error("Location name is required"); return; }
    if (!isMainWarehouse && !selectedBusiness) {
      toast.error("Please select a business for this location");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        is_main: isMainWarehouse,
        business_id: isMainWarehouse ? null : selectedBusiness,
      };
      const res = await fetch("/api/settings/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      toast.success("Location added successfully");
      setName("");
      setIsMainWarehouse(false);
      setSelectedBusiness("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      const res = await fetch(`/api/settings/locations?id=${deleteDialog.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Location deleted");
      setLocations((prev) => prev.filter((l) => l.id !== deleteDialog.id));
      setDeleteDialog({ open: false, id: null, name: "" });
    } catch {
      toast.error("Failed to delete location");
    }
  };

  return (
    <>
      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{deleteDialog.name}&quot;</strong>? This action may affect existing stock records and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-200">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Stock Locations</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Manage warehouses and showroom locations</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
            {locations.length} location{locations.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left: Add Form */}
          <Card className="md:col-span-1 h-fit border-emerald-100 shadow-sm">
            <CardHeader className="pb-4 bg-emerald-50/50 rounded-t-xl">
              <CardTitle className="text-base text-emerald-800">Add Location</CardTitle>
              <CardDescription>Create a new inventory storage location.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {/* Main Warehouse toggle */}
              <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50/40 p-3 rounded-lg">
                <Checkbox
                  id="main-wh"
                  checked={isMainWarehouse}
                  onCheckedChange={handleMainCheckChange}
                  disabled={mainWarehouseExists}
                  className="mt-0.5"
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="main-wh" className="text-sm font-semibold peer-disabled:opacity-60">
                    Main Warehouse
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {mainWarehouseExists ? "A main warehouse already exists." : "Global central storage location."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Location Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. Galle Showroom"
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isMainWarehouse && mainWarehouseExists}
                  />
                </div>
              </div>

              {!isMainWarehouse && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Business <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Business" />
                    </SelectTrigger>
                    <SelectContent>
                      {businesses.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                onClick={handleAdd}
                disabled={submitting || (isMainWarehouse && mainWarehouseExists)}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Location
              </Button>
            </CardContent>
          </Card>

          {/* Right: List */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Active Locations</CardTitle>
              <CardDescription>All inventory locations in your system.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : locations.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl border-emerald-200 bg-emerald-50/30">
                  <Store className="h-10 w-10 text-emerald-400 mx-auto mb-3 opacity-70" />
                  <h3 className="text-base font-semibold text-gray-700">No Locations Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Start by creating your Main Warehouse.</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Location</TableHead>
                        <TableHead className="font-semibold">Business</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations.map((loc) => (
                        <TableRow key={loc.id} className={loc.isMain ? "bg-emerald-50/40" : "hover:bg-gray-50/50"}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${loc.isMain ? "bg-emerald-100" : "bg-gray-100"}`}>
                                {loc.isMain
                                  ? <Warehouse className="h-3.5 w-3.5 text-emerald-600" />
                                  : <MapPin className="h-3.5 w-3.5 text-gray-500" />}
                              </div>
                              <span className="font-semibold text-gray-800">{loc.name}</span>
                              {loc.isMain && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-semibold" variant="outline">
                                  Main
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Building2 className="w-3.5 h-3.5" />
                              <span className={loc.isMain ? "italic" : ""}>{loc.businessName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {!loc.isMain && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteDialog({ open: true, id: loc.id, name: loc.name })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
