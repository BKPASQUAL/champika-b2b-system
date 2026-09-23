"use client";

import React, { useState, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Search,
  AlertTriangle,
  Loader2,
  Calendar,
  MapPin,
  DollarSign,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { TablePagination } from "@/components/ui/TablePagination";

export default function SierraDamageHistoryPage() {
  const router = useRouter();
  const { data: damages = [], loading, refetch: fetchDamages } = useCachedFetch<any[]>(
    `/api/inventory/damage?businessId=${BUSINESS_IDS.SIERRA_AGENCY}`,
    [],
    () => toast.error("Error loading history")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredDamages = damages.filter(
    (item) =>
      (item.products?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reason || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.return_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.products?.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDamagedUnits = filteredDamages.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const totalDamagedValue = filteredDamages.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity || 0) *
        (item.products?.actual_cost_price || item.products?.cost_price || 0),
    0
  );

  const { data: inventoryData } = useCachedFetch<any>(
    `/api/inventory?businessId=${BUSINESS_IDS.SIERRA_AGENCY}`,
    null
  );

  const liveDamagedUnits =
    inventoryData?.locations?.find((l: any) => l.isDamageLocation)?.totalDamaged || 0;
  const liveDamagedValue =
    inventoryData?.locations?.find((l: any) => l.isDamageLocation)?.totalValue || 0;

  // Pagination
  const totalPages = Math.ceil(filteredDamages.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDamages = filteredDamages.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Export PDF
  const handleExportPDF = () => {
    if (filteredDamages.length === 0) return toast.error("No damage data to export");
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFontSize(16);
    doc.text("Sierra Agency - Damage Stock Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${date} | Total Damaged Units: ${totalDamagedUnits} | Total Value: LKR ${totalDamagedValue.toLocaleString()}`, 14, 22);

    const tableRows = filteredDamages.map((item) => {
      const unitCost = Number(item.products?.actual_cost_price || item.products?.cost_price || 0);
      const totalVal = Number(item.quantity || 0) * unitCost;
      return [
        item.return_number,
        new Date(item.created_at).toLocaleDateString(),
        item.locations?.name || "Main Warehouse",
        `${item.products?.name || ""} (${item.products?.sku || ""})`,
        item.reason || "-",
        item.quantity,
        `LKR ${totalVal.toLocaleString()}`,
        item.profiles?.full_name || "Admin",
      ];
    });

    autoTable(doc, {
      head: [["Report #", "Date", "Location", "Product", "Reason / Type", "Qty", "Value", "Reported By"]],
      body: tableRows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [147, 51, 234] },
    });
    doc.save(`Sierra_Damage_Report_${date}.pdf`);
  };

  // Export Excel
  const handleExportExcel = () => {
    if (filteredDamages.length === 0) return toast.error("No damage data to export");
    const excelData = filteredDamages.map((item) => {
      const unitCost = Number(item.products?.actual_cost_price || item.products?.cost_price || 0);
      const totalVal = Number(item.quantity || 0) * unitCost;
      return {
        "Report #": item.return_number,
        Date: new Date(item.created_at).toLocaleDateString(),
        Location: item.locations?.name || "Main Warehouse",
        Product: item.products?.name || "",
        SKU: item.products?.sku || "",
        "Reason / Type": item.reason || "",
        Quantity: item.quantity,
        "Unit Cost": unitCost,
        "Total Value": totalVal,
        "Reported By": item.profiles?.full_name || "Admin",
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Damages");
    XLSX.writeFile(wb, `Sierra_Damage_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/office/sierra/inventory")}
              className="-ml-2 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-purple-950">
              Damage Reports (Sierra)
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            History and stock value of internal damages for Sierra Agency.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExportPDF} size="sm">
            <FileDown className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} size="sm">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={fetchDamages} size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={() =>
              router.push("/dashboard/office/sierra/inventory/damage/adjust")
            }
          >
            Adjust Damaged Stock
          </Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => router.push("/dashboard/office/sierra/inventory/damage/create")}
          >
            <Plus className="w-4 h-4 mr-2" /> Report New Damage
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Damaged Stock
            </CardTitle>
            <Trash2 className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Number(liveDamagedUnits).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Current live damaged units in warehouse</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Damaged Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              LKR {Number(liveDamagedValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total cost value of current damaged stock</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Damage Reports History
            </CardTitle>
            <Package className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {filteredDamages.length}
            </div>
            <p className="text-xs text-muted-foreground">{totalDamagedUnits.toLocaleString()} total units logged historically</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Damage History</CardTitle>
              <CardDescription>
                Detailed log of internal product damages with stock values.
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search report #, product, SKU..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredDamages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No damage reports found for Sierra Agency.</p>
            </div>
          ) : (
            <>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-purple-50/50">
                      <TableHead>Report #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Reason / Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Stock Value</TableHead>
                      <TableHead className="text-right">Reported By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDamages.map((item) => {
                      const unitCost = Number(
                        item.products?.actual_cost_price ||
                          item.products?.cost_price ||
                          0
                      );
                      const itemVal = Number(item.quantity || 0) * unitCost;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {item.return_number}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.created_at).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              {item.locations?.name || "Main Warehouse"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{item.products?.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">{item.products?.sku}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                              {item.reason}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-medium text-purple-950">
                            LKR {itemVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {item.profiles?.full_name || "Admin"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredDamages.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(newSize) => {
                  setItemsPerPage(newSize);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
