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
import { Checkbox } from "@/components/ui/checkbox"; // Ensure you have this component
import { Badge } from "@/components/ui/badge";
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

  // Form State
  const [name, setName] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [isMainWarehouse, setIsMainWarehouse] = useState(false);

  // Check if Main Warehouse already exists in the list
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
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Checkbox Change
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
    if (!name.trim()) {
      toast.error("Location name is required");
      return;
    }

    // Validation: Require business if NOT Main Warehouse
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

      // Reset Form
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This might affect stock records.")) return;

    try {
      const res = await fetch(`/api/settings/locations?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Location deleted");
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch (error) {
      toast.error("Failed to delete location");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Left Column: Add Form */}
      <Card className="md:col-span-1 h-fit">
        <CardHeader>
          <CardTitle>Add Location</CardTitle>
          <CardDescription>Create storage locations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Warehouse Checkbox */}
          <div className="flex items-center space-x-2 border p-3 rounded-md bg-muted/30">
            <Checkbox
              id="main-wh"
              checked={isMainWarehouse}
              onCheckedChange={handleMainCheckChange}
              disabled={mainWarehouseExists} // Disable if one already exists
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="main-wh"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Is Main Warehouse?
              </Label>
              <p className="text-xs text-muted-foreground">
                {mainWarehouseExists
                  ? "Main Warehouse already exists."
                  : "Global central storage."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
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
              <Label>
                Business <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedBusiness}
                onValueChange={setSelectedBusiness}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Business" />
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

          <Button
            className="w-full"
            onClick={handleAdd}
            disabled={submitting || (isMainWarehouse && mainWarehouseExists)}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Location
          </Button>
        </CardContent>
      </Card>

      {/* Right Column: List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Stock Locations</CardTitle>
          <CardDescription>Active inventory locations.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-medium">No Locations</h3>
              <p className="text-sm text-muted-foreground">
                Start by creating your Main Warehouse.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location Name</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc) => (
                    <TableRow
                      key={loc.id}
                      className={loc.isMain ? "bg-muted/30" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {loc.isMain ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                          )}
                          {loc.name}
                          {loc.isMain && (
                            <Badge variant="secondary" className="ml-2">
                              Main
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          <span
                            className={
                              loc.isMain
                                ? "font-semibold italic text-muted-foreground"
                                : ""
                            }
                          >
                            {loc.businessName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {!loc.isMain && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(loc.id)}
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
  );
}
