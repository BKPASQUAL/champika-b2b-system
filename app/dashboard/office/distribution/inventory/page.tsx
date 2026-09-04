"use client";

import React, { useState, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
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
  DollarSign,
  MapPin,
  Search,
  RefreshCw,
  Store,
  Building2,
  ArrowRightLeft,
  Trash2,
  FileDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BUSINESS_IDS } from "@/app/config/business-constants"; // Import Constants
import { TablePagination } from "@/components/ui/TablePagination";

const ITEMS_PER_PAGE = 10;

export default function InventoryPage() {
  const router = useRouter();
  const { data = null, loading, refetch: fetchData } = useCachedFetch<any>(
    `/api/inventory?businessId=${BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}`,
    null,
    () => toast.error("Error fetching stock data")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "in_stock" | "zero_stock" | "negative_stock" | "damaged"
  >("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [reconciling, setReconciling] = useState(false);

  const handleReconcileNegative = async () => {
    if (
      !confirm(
        `Are you sure you want to reset all ${negativeStockCount} negative stock item(s) to 0 across distribution inventory?\n\nThis will adjust all negative stock quantities to 0 and record audit logs.`
      )
    ) {
      return;
    }

    try {
      setReconciling(true);
      const res = await fetch("/api/inventory/reconcile-negative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Bulk reconciliation of negative stock to 0 via Distribution Overview",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Reconciliation failed");

      toast.success(
        result.message || `Successfully reset ${result.count} items to 0!`
      );

      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset negative stock");
    } finally {
      setReconciling(false);
    }
  };

  const allProducts = data?.products || [];
  const inStockCount = allProducts.filter((p: any) => Number(p.stock_quantity) > 0).length;
  const zeroStockCount = allProducts.filter((p: any) => Number(p.stock_quantity) === 0).length;
  const negativeStockCount = allProducts.filter((p: any) => Number(p.stock_quantity) < 0).length;
  const damagedStockCount = allProducts.filter((p: any) => Number(p.damaged_quantity) > 0).length;

  // Filter Products
  const filteredProducts =
    allProducts.filter((p: any) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      const good = Number(p.stock_quantity) || 0;
      const damaged = Number(p.damaged_quantity) || 0;

      if (statusFilter === "in_stock") return good > 0;
      if (statusFilter === "zero_stock") return good === 0;
      if (statusFilter === "negative_stock") return good < 0;
      if (statusFilter === "damaged") return damaged > 0;
      return true;
    }) || [];

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // --- Export to PDF ---
  const handleExportPDF = () => {
    if (!data || filteredProducts.length === 0) return toast.error("No data");
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFontSize(16);
    doc.text("Champika Distribution - Inventory Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${date}`, 14, 22);

    const tableRows = filteredProducts.map((p: any) => [
      p.sku,
      p.name,
      p.category || "-",
      Number(p.stock_quantity) || 0,
      Number(p.damaged_quantity) || 0,
      (Number(p.stock_quantity) || 0) + (Number(p.damaged_quantity) || 0),
      (Number(p.stock_quantity) || 0) <= p.min_stock_level ? "Low/Out" : "OK",
    ]);

    autoTable(doc, {
      head: [["SKU", "Name", "Category", "Good", "Bad", "Total", "Status"]],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 0] },
    });
    doc.save(`Distribution_Inventory_${date}.pdf`);
  };

  // --- Export to Excel ---
  const handleExportExcel = () => {
    if (!data || filteredProducts.length === 0) return toast.error("No data");
    const excelData = filteredProducts.map((p: any) => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category || "-",
      "Good Stock": Number(p.stock_quantity) || 0,
      "Damaged Stock": Number(p.damaged_quantity) || 0,
      Total:
        (Number(p.stock_quantity) || 0) + (Number(p.damaged_quantity) || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(
      wb,
      `Distribution_Inventory_${new Date().toLocaleDateString()}.xlsx`
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalDamaged = allProducts.reduce(
    (sum: number, p: any) => sum + (Number(p.damaged_quantity) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Stock Control (Distribution)
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor inventory levels, returns, and damages for Champika
            Distribution.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} size="sm">
            <FileDown className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} size="sm">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => router.push("/dashboard/office/distribution/inventory/transfer")}
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Stock Transfer
          </Button>
          <Button
            variant="destructive"
            onClick={() => router.push("/dashboard/office/distribution/inventory/damage")}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Report Damage
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setStatusFilter("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Inventory Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {(data.stats.totalValue / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground">
              Distribution Stock Value
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            statusFilter === "zero_stock"
              ? "border-amber-600 ring-1 ring-amber-600"
              : "hover:border-amber-500"
          }`}
          onClick={() => setStatusFilter("zero_stock")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Zero Stock Items</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {zeroStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              0 Quantity SKUs (Click to view)
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            statusFilter === "negative_stock"
              ? "border-red-600 ring-1 ring-red-600"
              : "hover:border-red-500"
          }`}
          onClick={() => setStatusFilter("negative_stock")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Negative Stock</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {negativeStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Oversold SKUs (Click to view)
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            statusFilter === "damaged"
              ? "border-orange-600 ring-1 ring-orange-600"
              : "hover:border-orange-500"
          }`}
          onClick={() => setStatusFilter("damaged")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Damaged Stock</CardTitle>
            <Trash2 className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalDamaged}
            </div>
            <p className="text-xs text-muted-foreground">
              Marked as damaged ({damagedStockCount} SKUs)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Location Table */}
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
                {data.locations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-4 text-muted-foreground"
                    >
                      No locations found for this business.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.locations.map((loc: any) => (
                    <TableRow
                      key={loc.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        router.push(`/dashboard/office/distribution/inventory/${loc.id}`)
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
                              ? "bg-green-50 text-green-700"
                              : ""
                          }
                        >
                          {loc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(loc.totalItems || 0).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        LKR{" "}
                        {Number(loc.totalValue || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Master Inventory Table (With Pagination & Damage) */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" /> Master Inventory
                </CardTitle>
                <CardDescription>
                  Detailed stock levels (Distribution Only). Click any filter below for 1-click status view.
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

            {/* 1-Click Stock Status Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="h-8 text-xs"
              >
                All Products ({allProducts.length})
              </Button>
              <Button
                variant={statusFilter === "in_stock" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("in_stock")}
                className={`h-8 text-xs ${
                  statusFilter === "in_stock"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "text-green-700 border-green-200 hover:bg-green-50"
                }`}
              >
                In Stock (&gt;0) ({inStockCount})
              </Button>
              <Button
                variant={statusFilter === "zero_stock" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("zero_stock")}
                className={`h-8 text-xs font-semibold ${
                  statusFilter === "zero_stock"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "text-amber-700 border-amber-300 hover:bg-amber-50"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Zero Stock (0) ({zeroStockCount})
              </Button>
              <Button
                variant={statusFilter === "negative_stock" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("negative_stock")}
                className={`h-8 text-xs ${
                  statusFilter === "negative_stock"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "text-red-700 border-red-200 hover:bg-red-50"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Negative Stock (&lt;0) ({negativeStockCount})
              </Button>

              {negativeStockCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReconcileNegative}
                  disabled={reconciling}
                  className="h-8 text-xs ml-auto font-semibold bg-red-700 hover:bg-red-800 shadow-sm"
                  title="Bulk reset all negative stock items to 0"
                >
                  {reconciling ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Reset {negativeStockCount} Negative Stock(s) to 0
                </Button>
              )}
              <Button
                variant={statusFilter === "damaged" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("damaged")}
                className={`h-8 text-xs ${
                  statusFilter === "damaged"
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "text-orange-700 border-orange-200 hover:bg-orange-50"
                }`}
              >
                Damaged Stock ({damagedStockCount})
              </Button>
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
                {paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product: any) => {
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
                          {good < 0 ? (
                            <span className="text-red-600 font-bold">
                              {good.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          ) : (
                            good.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {damaged > 0
                            ? damaged.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {Number((good + damaged).toFixed(2)).toLocaleString(
                            undefined,
                            { maximumFractionDigits: 2 }
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {good < 0 ? (
                            <Badge variant="destructive">Negative Stock</Badge>
                          ) : good === 0 ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">Out of Stock</Badge>
                          ) : good <= product.min_stock_level ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-green-600 bg-green-50"
                            >
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
