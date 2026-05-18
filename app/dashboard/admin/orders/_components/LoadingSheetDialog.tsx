"use client";

import React, { useState, useEffect } from "react";
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
import { Truck, Users, Calendar, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface Person {
  id: string;
  fullName: string;
  role: string;
}

interface LoadingSheetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (data: any) => void;
  preselectedLorry?: string;
}


export function LoadingSheetDialog({
  isOpen,
  onOpenChange,
  selectedCount,
  onConfirm,
  preselectedLorry = "",
}: LoadingSheetDialogProps) {
  const [lorries, setLorries] = useState<{ id: string; name: string; phone?: string; ownerName?: string; }[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [formData, setFormData] = useState({
    lorryNumber: "",
    driverId: "",
    helperId: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        lorryNumber: preselectedLorry,
        driverId: "",
        helperId: "",
        date: new Date().toISOString().split("T")[0],
      });
      const loadData = async () => {
        setLoadingData(true);
        try {
          const [lorryRes, userRes] = await Promise.all([
            fetch("/api/settings/categories?type=lorry"),
            fetch("/api/users?roles=rep,delivery"),
          ]);
          if (lorryRes.ok) setLorries(await lorryRes.json());
          if (userRes.ok) setPersons(await userRes.json());
        } catch {
          toast.error("Failed to load data");
        } finally {
          setLoadingData(false);
        }
      };
      loadData();
    }
  }, [isOpen, preselectedLorry]);

  const handleSubmit = () => {
    if (!formData.lorryNumber) {
      toast.error("Please select a Lorry.");
      return;
    }
    if (!formData.driverId) {
      toast.error("Please select a Responsible Person.");
      return;
    }

    const selectedHelper = persons.find((u) => u.id === formData.helperId);

    onConfirm({
      lorryNumber: formData.lorryNumber,
      driverId: formData.driverId,
      helperName: selectedHelper ? selectedHelper.fullName : "",
      date: formData.date,
    });
    onOpenChange(false);
  };

  // Sort: drivers first, then reps
  const sorted = [...persons].sort((a, b) => {
    if (a.role === b.role) return a.fullName.localeCompare(b.fullName);
    return a.role === "delivery" ? -1 : 1;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Loading Sheet</DialogTitle>
          <DialogDescription>
            Assign <strong>{selectedCount}</strong> order
            {selectedCount !== 1 ? "s" : ""} to a delivery vehicle.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Date */}
          <div className="grid gap-2">
            <Label>Loading Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                className="pl-9 w-full"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
          </div>

          {/* Lorry */}
          <div className="grid gap-2">
            <Label>Select Lorry</Label>
            <Select
              value={formData.lorryNumber}
              onValueChange={(val) =>
                setFormData({ ...formData, lorryNumber: val })
              }
            >
              <SelectTrigger className="w-full pl-9 relative">
                <Truck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <SelectValue
                  placeholder={loadingData ? "Loading..." : "Select Vehicle"}
                />
              </SelectTrigger>
              <SelectContent>
                {lorries.map((l) => (
                  <SelectItem key={l.id} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsible Person + Helper */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Responsible Person</Label>
              <Select
                value={formData.driverId}
                onValueChange={(val) =>
                  setFormData({ ...formData, driverId: val })
                }
              >
                <SelectTrigger className="w-full pl-9 relative">
                  <UserCircle className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <SelectValue
                    placeholder={loadingData ? "Loading..." : "Select Person"}
                  />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {sorted.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Assistant / Helper</Label>
              <Select
                value={formData.helperId}
                onValueChange={(val) =>
                  setFormData({ ...formData, helperId: val })
                }
              >
                <SelectTrigger className="w-full pl-9 relative">
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select Helper" />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="none">None</SelectItem>
                  {sorted
                    .filter((u) => u.id !== formData.driverId)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loadingData}>
            Create Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
