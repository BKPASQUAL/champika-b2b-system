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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BUSINESS_IDS } from "@/app/config/business-constants"; // Ensure this import exists

const ITEMS_PER_PAGE = 10;

export default function OrangeInventoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch specifically for ORANGE AGENCY
      const res = await fetch(
        `/api/inventory?businessId=${BUSINESS_IDS.ORANGE_AGENCY}`
      );
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

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filter Products
  const filteredProducts =
    data?.products?.filter(
      (p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // --- Export to PDF ---
  const handleExportPDF = () => {
    if (!data || filteredProducts.length === 0) return toast.error("No data");
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFontSize(16);
    doc.text("Orange Agency - Inventory Report", 14, 15);
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
      headStyles: { fillColor: [234, 88, 12] }, // Orange Header Color
    });
    doc.save(`Orange_Inventory_${date}.pdf`);
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
      `Orange_Inventory_${new Date().toLocaleDateString()}.xlsx`
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <RefreshCw className="animate-spin h-8 w-8 text-orange-600" />
      </div>
    );
  }

  const totalDamaged = filteredProducts.reduce(
    (sum: number, p: any) => sum + (Number(p.damaged_quantity) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-orange-950">
            Stock Control (Orange)
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor inventory levels, returns, and damages for Orange Agency.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() =>
              router.push("/dashboard/office/orange/inventory/transfer")
            }
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Stock Transfer
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              router.push("/dashboard/office/orange/inventory/damage")
            }
          >
            <Trash2 className="w-4 h-4 mr-2" /> Report Damage
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inventory Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              LKR {(data.stats.totalValue / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground">Orange Stock Value</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Out of Stock
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.stats.outOfStock}
            </div>
            <p className="text-xs text-muted-foreground">Items unavailable</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Damaged Stock
            </CardTitle>
            <Trash2 className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalDamaged}
            </div>
            <p className="text-xs text-muted-foreground">Marked as damaged</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock
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

      {/* Location Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-600" /> Location Overview
          </CardTitle>
          <CardDescription>
            Click on a location to view detailed inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-orange-50/50">
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
                        router.push(
                          `/dashboard/office/orange/inventory/${loc.id}`
                        )
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
                        {loc.totalItems}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        LKR {loc.totalValue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Master Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-600" /> Master Inventory
              </CardTitle>
              <CardDescription>
                Detailed stock levels (Orange Agency).
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
                <TableRow className="bg-orange-50/50">
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

          {/* Pagination Controls */}
          <div className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredProducts.length > 0 ? startIndex + 1 : 0} to{" "}
              {Math.min(startIndex + ITEMS_PER_PAGE, filteredProducts.length)}{" "}
              of {filteredProducts.length} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
