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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Save, AlertTriangle } from "lucide-react";
import { Order } from "../types";

// Mock Items Data (In real app, fetch by order.id)
const MOCK_ORDER_ITEMS = [
  { id: "1", name: "Copper Wire 2.5mm", price: 150, qty: 50, stock: 500 },
  { id: "2", name: "PVC Pipe 4 inch", price: 850, qty: 20, stock: 100 },
  { id: "3", name: "Cement 50kg", price: 2800, qty: 10, stock: 45 },
];

interface PendingOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onConfirmProcess: (orderId: string) => void;
}

export function PendingOrderDialog({
  isOpen,
  onOpenChange,
  order,
  onConfirmProcess,
}: PendingOrderDialogProps) {
  const [items, setItems] = useState(MOCK_ORDER_ITEMS);
  const [isEditing, setIsEditing] = useState(false);

  // Reset items when modal opens with a new order
  useEffect(() => {
    if (isOpen) {
      setItems(MOCK_ORDER_ITEMS); // Reset to default/fetched items
      setIsEditing(false);
    }
  }, [isOpen, order]);

  if (!order) return null;

  const handleQtyChange = (id: string, newQty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(0, newQty) } : item
      )
    );
    setIsEditing(true);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.qty, 0);
  };

  const handleSave = () => {
    // In real app: API call to update order items
    setIsEditing(false);
    alert("Order items updated successfully!");
  };

  const handleProcess = () => {
    if (isEditing) {
      alert("Please save your changes before processing.");
      return;
    }
    onConfirmProcess(order.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between mr-8">
            <DialogTitle className="text-xl">
              Review Order: {order.orderId}
            </DialogTitle>
            <Badge
              variant="secondary"
              className="bg-yellow-100 text-yellow-700"
            >
              Pending Review
            </Badge>
          </div>
          <DialogDescription>
            Check stock availability and verify items before moving to
            processing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
          {/* Customer Info */}
          <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase">
              Customer Details
            </h4>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">
                  Shop Name
                </span>
                <span className="font-medium">{order.shopName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">
                  Owner
                </span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">
                  Sales Rep
                </span>
                <span className="font-medium">{order.salesRep}</span>
              </div>
            </div>
          </div>

          {/* Order Items Table */}
          <div className="md:col-span-2 border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center w-[100px]">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Stock: {item.stock}
                        </span>
                        {item.qty > item.stock && (
                          <span className="text-xs text-red-600 flex items-center mt-1">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Low Stock
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.price.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) =>
                          handleQtyChange(
                            item.id,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="h-8 w-20 text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(item.price * item.qty).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Total Section */}
            <div className="flex justify-end items-center p-4 bg-muted/20 border-t gap-4">
              <span className="text-sm text-muted-foreground">
                Total Amount:
              </span>
              <span className="text-lg font-bold text-primary">
                LKR {calculateTotal().toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            {isEditing && (
              <Button
                variant="secondary"
                onClick={handleSave}
                className="flex-1 sm:flex-none"
              >
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            )}
            <Button
              onClick={handleProcess}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
              disabled={isEditing} // Force save before processing
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Process
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
