"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Search,
  Package,
  DollarSign,
  Loader2,
  AlertTriangle,
  FileDown,
  FileSpreadsheet,
  FileWarning,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { LocationSettingsSheet } from "./_components/LocationSettingsSheet";
import { TablePagination } from "@/components/ui/TablePagination";

export default function LocationInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "in_stock" | "zero_stock" | "negative_stock" | "damaged"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [reconciling, setReconciling] = useState(false);

  const rawId = params?.id;
  const locationId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    const fetchData = async () => {
      if (!locationId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/inventory/${locationId}?includeAll=true`);
        if (!res.ok) throw new Error("Failed to load location data");
        setData(await res.json());
      } catch (error) {
        toast.error("Error fetching data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [locationId]);

  // Reset pagination on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // --- Export Functions ---
  const generatePDF = (items: any[], title: string, filename: string) => {
    if (!items.length) return toast.error("No data to export");
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Location: ${data.location.name}`, 14, 22);
    doc.text(`Generated on: ${date}`, 14, 27);

    const tableRows = items.map((stock: any) => [
      stock.sku,
      stock.name,
      stock.quantity,
      stock.damagedQuantity || 0,
      stock.quantity + (stock.damagedQuantity || 0),
      stock.unit_of_measure,
    ]);

    autoTable(doc, {
      head: [["SKU", "Product Name", "Good Qty", "Damaged", "Total", "Unit"]],
      body: tableRows,
      startY: 35,
      headStyles: { fillColor: [0, 0, 0] },
    });

    doc.save(`${filename}_${date.replace(/\//g, "-")}.pdf`);
  };

  const generateExcel = (items: any[], sheetName: string, filename: string) => {
    if (!items.length) return toast.error("No data to export");
    const excelData = items.map((stock: any) => ({
      SKU: stock.sku,
      "Product Name": stock.name,
      "Good Quantity": stock.quantity,
      "Damaged Quantity": stock.damagedQuantity || 0,
      "Total Quantity": stock.quantity + (stock.damagedQuantity || 0),
      Unit: stock.unit_of_measure,
      "Value (LKR)": stock.value,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(
      wb,
      `${filename}_${new Date().toLocaleDateString().replace(/\//g, "-")}.xlsx`
    );
  };

  const handleExportAll = (type: "pdf" | "excel") => {
    const items = filteredStocks || [];
    if (type === "pdf")
      generatePDF(items, "Location Inventory Report", "Inventory_Report");
    else generateExcel(items, "Inventory", "Inventory_Report");
  };

  const handleExportDamage = (type: "pdf" | "excel") => {
    const items =
      data?.stocks.filter((s: any) => (s.damagedQuantity || 0) > 0) || [];
    if (type === "pdf")
      generatePDF(items, "Damage Stock Report", "Damage_Report");
    else generateExcel(items, "Damaged Items", "Damage_Report");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !locationId) {
    return <div>Location not found</div>;
  }

  const handleReconcileNegative = async () => {
    if (
      !confirm(
        `Are you sure you want to reset all ${negativeStockCount} negative stock item(s) to 0 at ${data?.location?.name || "this location"}?\n\nThis will adjust all negative stock quantities to 0 and record audit entries.`
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
          locationId,
          reason: "Manual bulk reconciliation of negative stock to 0",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Reconciliation failed");

      toast.success(
        result.message || `Successfully reset ${result.count} items to 0!`
      );

      // Refetch page data
      const refreshRes = await fetch(`/api/inventory/${locationId}?includeAll=true`);
      if (refreshRes.ok) {
        setData(await refreshRes.json());
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reset negative stock");
    } finally {
      setReconciling(false);
    }
  };

  const allStocks = data?.stocks || [];
  const inStockCount = allStocks.filter((s: any) => Number(s.quantity) > 0).length;
  const zeroStockCount = allStocks.filter((s: any) => Number(s.quantity) === 0).length;
  const negativeStockCount = allStocks.filter((s: any) => Number(s.quantity) < 0).length;
  const damagedStockCount = allStocks.filter((s: any) => Number(s.damagedQuantity) > 0).length;

  const filteredStocks = allStocks.filter((s: any) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sku.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === "in_stock") return Number(s.quantity) > 0;
    if (statusFilter === "zero_stock") return Number(s.quantity) === 0;
    if (statusFilter === "negative_stock") return Number(s.quantity) < 0;
    if (statusFilter === "damaged") return Number(s.damagedQuantity) > 0;
    return true;
  });

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
  const paginatedStocks = filteredStocks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              {data.location.name}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Building2 className="w-3 h-3" />
              {data.location.businessName}
              <span className="text-gray-300">|</span>
              {data.location.is_active ? (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-200 bg-green-50"
                >
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {/* ✅ Navigate to New Adjustment Page */}
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              router.push(
                `/dashboard/office/distribution/inventory/${locationId}/adjust`
              )
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ClipboardList className="w-4 h-4 mr-2" /> Adjust Stock
          </Button>

          {/* Export Group */}
          <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-lg border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExportAll("pdf")}
              title="Export Filtered PDF"
            >
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExportAll("excel")}
              title="Export Filtered Excel"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>

          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExportDamage("pdf")}
              className="text-red-700 hover:text-red-800 hover:bg-red-100"
            >
              <FileWarning className="w-4 h-4 mr-2" /> Damage PDF
            </Button>
          </div>

          <LocationSettingsSheet
            locationId={locationId as string}
            locationName={data.location.name}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setStatusFilter("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR{" "}
              {Number(data.stats.totalValue || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Current stock worth</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            statusFilter === "in_stock" ? "border-green-600 ring-1 ring-green-600" : "hover:border-green-500"
          }`}
          onClick={() => setStatusFilter("in_stock")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Good Stock</CardTitle>
            <Package className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(data.stats.totalItems || 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {inStockCount} SKUs available
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            statusFilter === "zero_stock" ? "border-amber-600 ring-1 ring-amber-600" : "hover:border-amber-500"
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
            <p className="text-xs text-muted-foreground">SKUs with 0 quantity (Click to view)</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            statusFilter === "damaged" ? "border-red-600 ring-1 ring-red-600" : "hover:border-red-500"
          }`}
          onClick={() => setStatusFilter("damaged")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Damaged Stock</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Number(data.stats.totalDamaged || 0).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Unusable units ({damagedStockCount} SKUs)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Current Inventory</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the 1-click filter buttons below to identify 0 stock, negative stock, or damaged stock.
                </p>
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
                All Products ({allStocks.length})
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
                  title="Bulk reset all negative stock items at this location to 0"
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
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Good Qty</TableHead>
                  <TableHead className="text-right text-red-600">
                    Damaged Qty
                  </TableHead>
                  <TableHead className="text-right">Value (LKR)</TableHead>
                  <TableHead className="text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStocks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No stock items found for current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStocks.map((stock: any) => {
                    const qty = Number(stock.quantity || 0);
                    return (
                      <TableRow key={stock.id}>
                        <TableCell className="font-mono text-xs">
                          {stock.sku}
                        </TableCell>
                        <TableCell className="font-medium">
                          {stock.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {stock.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          <div className="flex items-center justify-end gap-1.5">
                            {qty > 0 ? (
                              <span className="text-green-700">
                                {qty.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            ) : qty === 0 ? (
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-700 border-slate-300 font-medium"
                              >
                                0 (Out of Stock)
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="font-medium">
                                {qty.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })} (Oversold)
                              </Badge>
                            )}
                            <span className="text-xs font-normal text-muted-foreground">
                              {stock.unit_of_measure}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {stock.damagedQuantity > 0
                            ? Number(stock.damagedQuantity).toLocaleString(
                                undefined,
                                { maximumFractionDigits: 2 }
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(stock.value || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {stock.lastUpdated
                            ? format(new Date(stock.lastUpdated), "MMM d, yyyy")
                            : "-"}
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
            totalItems={filteredStocks.length}
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
