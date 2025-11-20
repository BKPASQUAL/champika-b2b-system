"use client";

import React, { useState } from "react";
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
import { Truck, Users, Calendar } from "lucide-react";
import { MOCK_DRIVERS, MOCK_LORRIES } from "../loading/types";

interface LoadingSheetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (data: any) => void;
}

export function LoadingSheetDialog({
  isOpen,
  onOpenChange,
  selectedCount,
  onConfirm,
}: LoadingSheetDialogProps) {
  const [formData, setFormData] = useState({
    lorryNumber: "",
    driver: "",
    helper: "",
    date: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = () => {
    if (!formData.lorryNumber || !formData.driver || !formData.date) {
      alert("Please fill in Lorry, Driver and Date.");
      return;
    }
    onConfirm(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Loading Sheet</DialogTitle>
          <DialogDescription>
            Assign {selectedCount} selected orders to a delivery vehicle.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Loading Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                className="pl-9"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Select Lorry</Label>
            <Select
              value={formData.lorryNumber}
              onValueChange={(val) =>
                setFormData({ ...formData, lorryNumber: val })
              }
            >
              <SelectTrigger className="pl-9 relative">
                <Truck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select Vehicle" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_LORRIES.map((l) => (
                  <SelectItem key={l.id} value={l.number}>
                    {l.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Responsible Person (Driver)</Label>
              <Select
                value={formData.driver}
                onValueChange={(val) =>
                  setFormData({ ...formData, driver: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Driver" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_DRIVERS.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assistant / Helper (Optional)</Label>
              <Input
                placeholder="Helper Name"
                value={formData.helper}
                onChange={(e) =>
                  setFormData({ ...formData, helper: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Load & Complete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
