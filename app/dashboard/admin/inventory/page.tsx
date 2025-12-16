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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Layers,
  AlertTriangle,
  Package,
  DollarSign,
  MapPin,
  Search,
  RefreshCw,
  Store,
  Building2,
  ArrowRightLeft,
  Undo2, // Import Undo2 icon
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export default function InventoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to load inventory");
      const jsonData = await res.json();
      setData(jsonData);
    } catch (error) {
      toast.error("Error fetching stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Products
  const filteredProducts =
    data?.products?.filter(
      (p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <RefreshCw className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  // Calculate Total Damaged from loaded products
  const totalDamaged = filteredProducts.reduce(
    (sum: number, p: any) => sum + (Number(p.damaged_quantity) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Control</h1>
          <p className="text-muted-foreground mt-1">
            Monitor inventory levels, returns, and damages across all
            businesses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Link to Returns Page */}
          <Button
            variant="secondary"
            onClick={() => router.push("/dashboard/admin/inventory/returns")}
          >
            <Undo2 className="w-4 h-4 mr-2" /> Returns & Damages
          </Button>

          <Button
            onClick={() => router.push("/dashboard/admin/inventory/transfer")}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Stock Transfer
          </Button>
        </div>
      </div>

      {/* 1. KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inventory Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {(data.stats.totalValue / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground">Good Stock Value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.stats.outOfStock}
            </div>
            <p className="text-xs text-muted-foreground">Items unavailable</p>
          </CardContent>
        </Card>

        {/* NEW KPI: Damaged Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Damaged Stock</CardTitle>
            <Trash2 className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalDamaged}
            </div>
            <p className="text-xs text-muted-foreground">
              Units marked as damaged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Alerts
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {data.stats.lowStock}
            </div>
            <p className="text-xs text-muted-foreground">Below minimum level</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Locations Table (Existing Code kept same) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" /> Location Overview
          </CardTitle>
          <CardDescription>
            Click on a location to view detailed inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Location Name</TableHead>
                  <TableHead>Business Entity</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Total Items</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.locations.map((loc: any) => (
                  <TableRow
                    key={loc.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(`/dashboard/admin/inventory/${loc.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        {loc.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        {loc.business}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          loc.status === "Active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : ""
                        }
                      >
                        {loc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {loc.totalItems}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      LKR {loc.totalValue.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 3. Product Stock Table with Damaged Column */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" /> Master Inventory
              </CardTitle>
              <CardDescription>
                Detailed stock levels including damaged items.
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Good Stock</TableHead>
                  <TableHead className="text-right text-red-600">
                    Damaged
                  </TableHead>
                  <TableHead className="text-right">Total Units</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.slice(0, 10).map((product: any) => {
                  const damaged = Number(product.damaged_quantity) || 0;
                  const good = Number(product.stock_quantity) || 0;
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {product.sku}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {product.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        {good}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {damaged > 0 ? damaged : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {good + damaged}
                      </TableCell>
                      <TableCell className="text-center">
                        {good === 0 ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : good <= product.min_stock_level ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600">
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-200 bg-green-50"
                          >
                            In Stock
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
