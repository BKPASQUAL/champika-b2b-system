"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";

export default function StockTransferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [locations, setLocations] = useState<any[]>([]);
  const [sourceProducts, setSourceProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Form
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [reason, setReason] = useState("");

  // Selection State: map of productId -> transferQuantity
  // If a product ID is in this map with a value > 0, it is "selected".
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(
    {}
  );

  // Initial Data Fetch
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch("/api/settings/locations");
        if (res.ok) {
          setLocations(await res.json());
        }
      } catch (error) {
        toast.error("Failed to load locations");
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, []);

  // Fetch Products when Source Changes
  useEffect(() => {
    if (!sourceId) {
      setSourceProducts([]);
      return;
    }

    const fetchSourceStock = async () => {
      try {
        setStockLoading(true);
        const res = await fetch(`/api/inventory/${sourceId}`);
        if (res.ok) {
          const data = await res.json();
          // Only show items with positive stock
          setSourceProducts(data.stocks.filter((s: any) => s.quantity > 0));
        }
      } catch (error) {
        toast.error("Failed to load source stock");
      } finally {
        setStockLoading(false);
      }
    };

    fetchSourceStock();
    // Reset selection when source changes
    setSelectedItems({});
  }, [sourceId]);

  // Handle Quantity Change (Typing in Input)
  const handleQtyChange = (productId: string, val: string, max: number) => {
    // If empty, remove from selection
    if (val === "") {
      const next = { ...selectedItems };
      delete next[productId];
      setSelectedItems(next);
      return;
    }

    const numVal = parseInt(val);

    // If invalid number, do nothing
    if (isNaN(numVal)) return;

    // If 0, remove from selection
    if (numVal <= 0) {
      const next = { ...selectedItems };
      delete next[productId];
      setSelectedItems(next);
      return;
    }

    // Cap at Max Quantity
    const safeVal = Math.min(numVal, max);

    setSelectedItems((prev) => ({
      ...prev,
      [productId]: safeVal,
    }));
  };

  // Handle Checkbox Toggle (Clicking Checkbox)
  const handleToggle = (productId: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[productId] !== undefined) {
        delete next[productId]; // Deselect
      } else {
        next[productId] = maxQty; // Select with max quantity by default
      }
      return next;
    });
  };

  // Handle "Select All"
  const handleSelectAll = () => {
    const filtered = sourceProducts.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const allSelected = filtered.every(
      (p) => selectedItems[p.id] !== undefined
    );

    if (allSelected) {
      // Deselect all visible
      const newSelection = { ...selectedItems };
      filtered.forEach((p) => delete newSelection[p.id]);
      setSelectedItems(newSelection);
    } else {
      // Select all visible with Max Qty
      const newSelection = { ...selectedItems };
      filtered.forEach((p) => {
        newSelection[p.id] = p.quantity;
      });
      setSelectedItems(newSelection);
    }
  };

  const handleTransfer = async () => {
    const itemsToTransfer = Object.entries(selectedItems)
      .map(([productId, qty]) => ({
        productId,
        quantity: qty,
      }))
      .filter((i) => i.quantity > 0);

    if (!sourceId || !destId) {
      toast.error("Please select source and destination");
      return;
    }

    if (sourceId === destId) {
      toast.error("Source and Destination cannot be the same");
      return;
    }

    if (itemsToTransfer.length === 0) {
      toast.error("Please select items to transfer");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sourceLocationId: sourceId,
        destLocationId: destId,
        items: itemsToTransfer,
        reason,
      };

      const res = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");

      toast.success(
        `Successfully transferred ${itemsToTransfer.length} products`
      );
      router.push("/dashboard/admin/inventory");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = sourceProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && locations.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/admin/inventory")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Bulk Stock Transfer</h1>
          <p className="text-muted-foreground text-sm">
            Move multiple products between locations.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <Label>From Location (Source)</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Source" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden md:flex justify-center pb-2">
              <ArrowRight className="text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label>To Location (Destination)</Label>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((l) => l.id !== sourceId)
                    .map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Transfer Reason / Reference</Label>
            <Input
              placeholder="e.g. Weekly Restock"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      {/* Product Selection Table */}
      {sourceId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <CardTitle>Select Products</CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <CardDescription>
              Enter quantities to transfer. Max available quantity is pre-filled
              when checking the box.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stockLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sourceProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No stock available at this source location.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            filteredProducts.length > 0 &&
                            filteredProducts.every(
                              (p) => selectedItems[p.id] !== undefined
                            )
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Product Details</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right w-[150px]">
                        Transfer Qty
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const isSelected =
                        selectedItems[product.id] !== undefined;
                      const transferQty = selectedItems[product.id] ?? ""; // Empty string if undefined

                      return (
                        <TableRow
                          key={product.id}
                          className={isSelected ? "bg-muted/30" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                handleToggle(product.id, product.quantity)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {product.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {product.quantity}{" "}
                            <span className="text-xs text-muted-foreground">
                              {product.unit_of_measure}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              max={product.quantity}
                              className="h-8 text-right font-medium"
                              placeholder="0"
                              value={transferQty}
                              onChange={(e) =>
                                handleQtyChange(
                                  product.id,
                                  e.target.value,
                                  product.quantity
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex justify-end gap-4 items-center px-8 z-50 shadow-md">
        <div className="text-sm text-muted-foreground mr-auto font-medium">
          {Object.keys(selectedItems).length} product(s) selected for transfer
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          onClick={handleTransfer}
          disabled={submitting || Object.keys(selectedItems).length === 0}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Confirm Transfer
        </Button>
      </div>
      <div className="h-16" /> {/* Spacer for fixed footer */}
    </div>
  );
}
