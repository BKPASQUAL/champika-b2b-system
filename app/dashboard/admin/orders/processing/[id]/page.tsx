"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PackageCheck,
  Loader2,
  User,
  MapPin,
  Phone,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils"; // <--- ADDED THIS IMPORT

export default function ProcessOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // State to track checked items for packing
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/${id}`);
        if (!res.ok) throw new Error("Failed to load order");
        const data = await res.json();
        setOrder(data);
        setItems(data.items);
      } catch (error) {
        toast.error("Could not fetch order data");
        router.push("/dashboard/admin/orders/processing");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, router]);

  const toggleItemCheck = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const areAllItemsChecked =
    items.length > 0 && items.every((item) => checkedItems[item.id]);

  const handleCompleteProcessing = async () => {
    if (!areAllItemsChecked) {
      if (!confirm("Not all items are checked. Proceed anyway?")) return;
    } else {
      if (!confirm("Finish packing and move to Checking?")) return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Checking" }),
      });

      if (!res.ok) throw new Error("Failed to update order");

      toast.success("Order moved to Checking!");
      router.push("/dashboard/admin/orders/processing");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Process Order</h1>
          <p className="text-muted-foreground text-sm">
            Pick and pack items for order <strong>{order.orderId}</strong>
          </p>
        </div>
      </div>

      {/* Top Section: Order Details */}
      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">
                Customer
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  {order.customer?.shopName}
                </span>
                <Badge variant="outline">{order.customer?.name}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {order.customer?.phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {order.customer?.route}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className="text-xs text-muted-foreground uppercase font-semibold">
                Current Status
              </span>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 px-3 py-1 text-sm">
                {order.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Rep: {order.salesRep}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Packing List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">Done</TableHead>
                <TableHead>Item Details</TableHead>
                <TableHead className="text-center w-[100px]">Qty</TableHead>
                <TableHead className="text-center w-[100px]">Free</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className={checkedItems[item.id] ? "bg-muted/30" : ""}
                >
                  <TableCell className="text-center">
                    <Checkbox
                      checked={checkedItems[item.id] || false}
                      onCheckedChange={() => toggleItemCheck(item.id)}
                      className="w-5 h-5"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-md border bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "font-medium",
                            checkedItems[item.id] &&
                              "text-muted-foreground line-through"
                          )}
                        >
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {item.sku} • {item.unit}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-bold text-lg">{item.qty}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.free > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 hover:bg-green-100 font-bold"
                      >
                        +{item.free}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t mt-8">
        <div className="text-sm text-muted-foreground">
          {Object.values(checkedItems).filter(Boolean).length} of {items.length}{" "}
          items packed
        </div>
        <Button
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
          onClick={handleCompleteProcessing}
          disabled={processing}
        >
          {processing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <PackageCheck className="w-4 h-4 mr-2" />
          )}
          Complete Packing
        </Button>
      </div>
    </div>
  );
}
