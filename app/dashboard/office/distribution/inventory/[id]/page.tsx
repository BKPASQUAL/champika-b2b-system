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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Import the settings component
import { LocationSettingsSheet } from "./_components/LocationSettingsSheet";

export default function LocationInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const rawId = params?.id;
  const locationId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    const fetchData = async () => {
      if (!locationId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/inventory/${locationId}`);
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
    const items = data?.stocks || [];
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
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !locationId) {
    return <div>Location not found</div>;
  }

  const filteredStocks = data.stocks.filter(
    (s: any) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sku.toLowerCase().includes(searchQuery.toLowerCase())
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
              title="Export All PDF"
            >
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExportAll("excel")}
              title="Export All Excel"
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {data.stats.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Current stock worth</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Good Stock</CardTitle>
            <Package className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalItems}</div>
            <p className="text-xs text-muted-foreground">Usable units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Damaged Stock</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.stats.totalDamaged}
            </div>
            <p className="text-xs text-muted-foreground">Unusable units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Unique Products
            </CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stocks.length}</div>
            <p className="text-xs text-muted-foreground">SKUs available</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle>Current Inventory</CardTitle>
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
                {filteredStocks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No stock found at this location.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStocks.map((stock: any) => (
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
                        {stock.quantity}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {stock.unit_of_measure}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {stock.damagedQuantity > 0
                          ? stock.damagedQuantity
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stock.value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {stock.lastUpdated
                          ? format(new Date(stock.lastUpdated), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
