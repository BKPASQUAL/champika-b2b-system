"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package,
  Search,
  RefreshCw,
  ExternalLink,
  Loader2,
  ChevronLeft,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

export default function StorefrontProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editBuffer, setEditBuffer] = useState<number>(5);
  const [savingProduct, setSavingProduct] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Toggle publish product
  const togglePublish = async (prod: any, newValue: boolean) => {
    try {
      const res = await fetch("/api/storefront/manage/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prod.id,
          isPublished: newValue,
          onlinePrice: prod.onlinePrice,
          stockBuffer: prod.stockBuffer,
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(newValue ? `${prod.name} is now LIVE online!` : `${prod.name} hidden from online store`);
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, isPublished: newValue } : p))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Save product details
  const saveProductSettings = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      const res = await fetch("/api/storefront/manage/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.id,
          isPublished: editingProduct.isPublished,
          onlinePrice: Number(editPrice),
          stockBuffer: Number(editBuffer),
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Product online settings saved!");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                onlinePrice: Number(editPrice),
                stockBuffer: Number(editBuffer),
                visibleOnlineStock: Math.max(0, p.warehouseStock - Number(editBuffer)),
              }
            : p
        )
      );
      setEditingProduct(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtered products
  const filteredProducts = products.filter((p) => {
    return (
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const publishedCount = products.filter((p) => p.isPublished).length;
  const inStockOnlineCount = products.filter((p) => p.isPublished && p.visibleOnlineStock > 0).length;

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/office/storefront">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Online Products & Pricing
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Control live store visibility, custom retail prices, and walk-in counter buffers
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open("/products", "_blank")}
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            View Public Catalog
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchProducts();
              toast.info("Refreshed product catalog");
            }}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Live Published</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{publishedCount}</div>
            <p className="text-xs text-emerald-600 font-medium mt-1">Visible on customer store</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">In Stock Online</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{inStockOnlineCount}</div>
            <p className="text-xs text-blue-600 font-medium mt-1">Available for instant order</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Total Inventory</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{products.length}</div>
            <p className="text-xs text-slate-500 mt-1">Catalog items</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Hidden Offline</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{products.length - publishedCount}</div>
            <p className="text-xs text-amber-600 font-medium mt-1">Internal only</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <CardTitle>Catalog Products ({filteredProducts.length})</CardTitle>
            <CardDescription>
              Toggle online publication and configure safety buffers for walk-in retail sales
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search product, SKU, brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand & SKU</TableHead>
                  <TableHead className="text-center">Physical Stock</TableHead>
                  <TableHead className="text-center">Safety Buffer</TableHead>
                  <TableHead className="text-center">Online Visible</TableHead>
                  <TableHead className="text-right">Base Price (Rs.)</TableHead>
                  <TableHead className="text-right">Online Price (Rs.)</TableHead>
                  <TableHead className="text-center">Live Online</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading catalog...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((p) => {
                    const isLive = p.isPublished;
                    const onlineStock = Math.max(0, (p.warehouseStock || 0) - (p.stockBuffer || 0));

                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500 capitalize">{p.category || "General"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {p.brand || "BK"}
                          </Badge>
                          <div className="text-[11px] text-slate-400 mt-0.5">{p.sku}</div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          <span className={p.warehouseStock <= 0 ? "text-rose-600 font-bold" : "text-slate-800"}>
                            {p.warehouseStock || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">
                            {p.stockBuffer || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs",
                              onlineStock > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            )}
                          >
                            {onlineStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-500">
                          Rs. {fmt(p.basePrice)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          Rs. {fmt(p.onlinePrice || p.basePrice)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={isLive}
                            onCheckedChange={(val) => togglePublish(p, val)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => {
                              setEditingProduct(p);
                              setEditPrice(p.onlinePrice || p.basePrice || 0);
                              setEditBuffer(p.stockBuffer || 0);
                            }}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                            Settings
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Product Modal */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Storefront Settings: {editingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Online Retail Price (Rs.)</label>
              <Input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Base cost: Rs. {fmt(editingProduct?.basePrice)}. Override to set customer price.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Walk-in Stock Buffer (Units)</label>
              <Input
                type="number"
                value={editBuffer}
                onChange={(e) => setEditBuffer(Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Reserved for store counter walk-in customers. (Total Stock: {editingProduct?.warehouseStock || 0} → Visible Online: {Math.max(0, (editingProduct?.warehouseStock || 0) - editBuffer)})
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={savingProduct}
              onClick={saveProductSettings}
            >
              {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
