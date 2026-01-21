"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Gift, ShoppingCart, ArrowRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function FreeIssueClaimsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchUnclaimedItems();
  }, []);

  const fetchUnclaimedItems = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/wireman/claims/free-issues");
      const data = await res.json();
      if (res.ok) {
        setItems(data);
      } else {
        toast.error("Failed to load unclaimed items");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  // 1. Navigate with selections
  const handleConvertSelected = () => {
    if (selectedIds.length === 0) return;
    const queryString = selectedIds.join(",");
    router.push(
      `/dashboard/office/wireman/purchases/create-free?ids=${queryString}`,
    );
  };

  // 2. Navigate empty (Manual mode)
  const handleCreateManual = () => {
    router.push(`/dashboard/office/wireman/purchases/create-free`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className=" space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Free Issue Claims
          </h1>
          <p className="text-muted-foreground">
            Manage free items or create new free bills.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Button 1: Manual Creation (No selection required) */}
          <Button
            variant="outline"
            onClick={handleCreateManual}
            className="border-green-600 text-green-700 hover:bg-green-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Manual Free Bill
          </Button>

          {/* Button 2: Convert Selected */}
          <Button
            onClick={handleConvertSelected}
            disabled={selectedIds.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Convert Selected ({selectedIds.length})
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-gray-500" />
            Pending Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      items.length > 0 && selectedIds.length === items.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Date / Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Free Qty</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No unclaimed items found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOne(item.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.orders.invoice_no || "Pending"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), "MMM dd")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{item.orders.customers?.shop_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.products.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.products.sku}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-orange-600">
                      {item.free_quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className="bg-yellow-50 text-yellow-700 border-yellow-200"
                      >
                        Pending
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
