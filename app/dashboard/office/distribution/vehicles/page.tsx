// app/dashboard/office/distribution/vehicles/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  MapPin,
  Loader2,
  User,
  Shield,
  Clock,
  History,
} from "lucide-react";
import { toast } from "sonner";

interface VehicleLocation {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  battery_level: number | null;
  updated_at: string;
  ignition?: boolean;
}

interface Vehicle {
  id: string;
  vehicleNumber: string;
  driverName: string | null;
  deviceId: string | null;
  status: string;
  createdAt: string;
  location: VehicleLocation | null;
}

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    vehicleNumber: "",
    driverName: "",
    deviceId: "",
    status: "Active",
  });

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error("Failed to load fleet");
      const data = await res.json();
      setVehicles(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load vehicles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const openAddDialog = () => {
    setFormData({
      vehicleNumber: "",
      driverName: "",
      deviceId: "",
      status: "Active",
    });
    setSelectedVehicle(null);
    setIsOpen(true);
  };

  const openEditDialog = (vehicle: Vehicle) => {
    setFormData({
      vehicleNumber: vehicle.vehicleNumber,
      driverName: vehicle.driverName || "",
      deviceId: vehicle.deviceId || "",
      status: vehicle.status,
    });
    setSelectedVehicle(vehicle);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleNumber.trim()) {
      toast.error("Vehicle registration number is required.");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!selectedVehicle;
      const url = isEdit ? `/api/vehicles/${selectedVehicle.id}` : "/api/vehicles";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleNumber: formData.vehicleNumber.trim(),
          driverName: formData.driverName.trim() || null,
          deviceId: formData.deviceId.trim() || null,
          status: formData.status,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save vehicle details");

      toast.success(`Vehicle ${isEdit ? "updated" : "added"} successfully.`);
      setIsOpen(false);
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.message || "Error saving vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVehicle) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/vehicles/${selectedVehicle.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete vehicle");
      toast.success("Vehicle removed from fleet.");
      setIsDeleteOpen(false);
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.message || "Error removing vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.driverName && v.driverName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.deviceId && v.deviceId.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-blue-900 flex items-center gap-2">
            <Truck className="h-8 w-8 text-blue-600 animate-pulse" /> Fleet Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Register delivery trucks, assign drivers, and track GPS telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchVehicles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        </div>
      </div>

      {/* Fleet Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Vehicles</CardTitle>
            <Truck className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{vehicles.length}</div>
            <p className="text-xs text-muted-foreground">Registered delivery trucks</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Signals</CardTitle>
            <MapPin className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {vehicles.filter((v) => v.location).length}
            </div>
            <p className="text-xs text-muted-foreground">Vehicles with active GPS coords</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Unpaired Trackers</CardTitle>
            <Shield className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {vehicles.filter((v) => !v.deviceId).length}
            </div>
            <p className="text-xs text-muted-foreground">Vehicles missing tracker IMEIs</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Delivery Vehicles</CardTitle>
            <CardDescription>View live GPS connection statuses and driver pairings.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search plate or driver..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead>Plate Number</TableHead>
                <TableHead>Driver Name</TableHead>
                <TableHead>Tracker IMEI (Device ID)</TableHead>
                <TableHead>Latest Coordinate Signal</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    <p className="text-xs text-slate-500 mt-2">Loading fleet directory...</p>
                  </TableCell>
                </TableRow>
              ) : filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    No vehicles found. Click "Add Vehicle" to register one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map((v) => {
                  const location = v.location;
                  return (
                    <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-semibold text-slate-900 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-slate-400 shrink-0" /> {v.vehicleNumber}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {v.driverName ? (
                          <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> {v.driverName}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {v.deviceId || <span className="text-amber-600 font-sans italic">Not paired</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {location ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-emerald-600" /> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5" /> {new Date(location.updated_at).toLocaleTimeString()}
                            </span>
                            <span className="mt-1 flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                location.ignition === true 
                                  ? (location.speed > 2 ? "bg-emerald-500 animate-pulse" : "bg-amber-500") 
                                  : "bg-slate-400"
                              }`} />
                              <span className="text-[10px] font-semibold text-slate-500">
                                {location.ignition === true 
                                  ? (location.speed > 2 ? "Engine: Running (Going)" : "Engine: On (Idling)") 
                                  : "Engine: Off (Parked)"}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No coordinates received</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {location ? (
                          <span className={location.speed > 0 ? "text-emerald-700 font-bold" : "text-slate-400"}>
                            {location.speed.toFixed(0)} km/h
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            v.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {v.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {location && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                title="Locate on Map"
                                onClick={() =>
                                  router.push(`/dashboard/office/distribution/customers/map?focusVehicle=${v.id}`)
                                }
                              >
                                <MapPin className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                title="View Route History"
                                onClick={() =>
                                  router.push(`/dashboard/office/distribution/customers/map?focusVehicle=${v.id}&history=true`)
                                }
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-600 hover:text-slate-800"
                            title="Edit Details"
                            onClick={() => openEditDialog(v)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            title="Remove Vehicle"
                            onClick={() => {
                              setSelectedVehicle(v);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{selectedVehicle ? "Edit Vehicle Info" : "Register New Vehicle"}</DialogTitle>
              <DialogDescription>
                Fill in the delivery truck details below. Device ID matches the tracker IMEI number.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehicleNumber">Plate / Registration Number</Label>
                <Input
                  id="vehicleNumber"
                  placeholder="e.g. WP GA-4321"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="driverName">Driver Name</Label>
                <Input
                  id="driverName"
                  placeholder="e.g. K. Silva"
                  value={formData.driverName}
                  onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deviceId">Tracker IMEI / Device ID</Label>
                <Input
                  id="deviceId"
                  placeholder="e.g. 358878730520522"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Fleet Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {selectedVehicle ? "Save Changes" : "Register Vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-950 font-bold">Remove Vehicle Registration?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove vehicle <strong>{selectedVehicle?.vehicleNumber}</strong> from the active fleet database? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
