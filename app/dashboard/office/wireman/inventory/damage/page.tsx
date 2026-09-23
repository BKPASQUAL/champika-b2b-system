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
import { Checkbox } from "@/components/ui/checkbox";
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
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { TablePagination } from "@/components/ui/TablePagination";

export default function WiremanDamageHistoryPage() {
  const router = useRouter();
  const { data: damages = [], loading, refetch: fetchDamages } = useCachedFetch<any[]>(
    `/api/inventory/damage?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
    [],
    () => toast.error("Error loading history")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hideZeroQty, setHideZeroQty] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, hideZeroQty]);

  const zeroQtyCount = damages.filter((d) => Number(d.quantity || 0) === 0).length;

  const filteredDamages = damages.filter((item) => {
    if (hideZeroQty && Number(item.quantity || 0) === 0) return false;
    return (
      (item.products?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reason || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.return_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.products?.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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

  const { data: inventoryData, refetch: refetchInventory } = useCachedFetch<any>(
    `/api/inventory?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
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

  // Selection Logic
  const allCurrentPageSelected =
    paginatedDamages.length > 0 &&
    paginatedDamages.every((item) => selectedIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !paginatedDamages.some((item) => item.id === id))
      );
    } else {
      const pageIds = paginatedDamages.map((item) => item.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single Delete
  const handleDeleteSingle = async (id: string, returnNo: string) => {
    if (!confirm(`Are you sure you want to delete damage record ${returnNo}?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/inventory/damage?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete record");
      toast.success(`Deleted damage record ${returnNo}`);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      fetchDamages();
      refetchInventory();
    } catch (e: any) {
      toast.error(e.message || "Error deleting record");
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete Selected
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected damage record(s)?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/inventory/damage`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) throw new Error("Failed to delete selected records");
      toast.success(`Successfully deleted ${selectedIds.length} damage record(s)`);
      setSelectedIds([]);
      fetchDamages();
      refetchInventory();
    } catch (e: any) {
      toast.error(e.message || "Error deleting records");
    } finally {
      setIsDeleting(false);
    }
  };

  // Clean Zero Quantity Logs
  const handleCleanZeroQty = async () => {
    if (!confirm(`Are you sure you want to remove all ${zeroQtyCount} zero-quantity damage logs?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/inventory/damage?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}&action=clear-zero`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to clean 0-quantity records");
      toast.success("Successfully cleaned all 0-quantity damage records");
      fetchDamages();
      refetchInventory();
    } catch (e: any) {
      toast.error(e.message || "Error cleaning logs");
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear All History Logs
  const handleClearAll = async () => {
    if (
      !confirm(
        "CAUTION: Are you sure you want to permanently clear ALL damage report history for Wireman Agency? Current warehouse stock is not affected."
      )
    )
      return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/inventory/damage?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}&action=clear-all`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to clear damage history");
      toast.success("All damage history records cleared");
      setSelectedIds([]);
      fetchDamages();
      refetchInventory();
    } catch (e: any) {
      toast.error(e.message || "Error clearing history");
    } finally {
      setIsDeleting(false);
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    if (filteredDamages.length === 0) return toast.error("No damage data to export");
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFontSize(16);
    doc.text("Wireman Agency - Damage Stock Report", 14, 15);
    doc.setFontSize(10);
    doc.text(
      `Generated: ${date} | Total Damaged Units: ${totalDamagedUnits} | Total Value: LKR ${totalDamagedValue.toLocaleString()}`,
      14,
      22
    );

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
      headStyles: { fillColor: [234, 88, 12] },
    });
    doc.save(`Wireman_Damage_Report_${date}.pdf`);
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
    XLSX.writeFile(wb, `Wireman_Damage_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/office/wireman/inventory")}
              className="-ml-2 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-orange-950">
              Damage Reports (Wireman)
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            History and stock value of internal damages for Wireman Agency.
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
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() =>
              router.push("/dashboard/office/wireman/inventory/damage/adjust")
            }
          >
            Adjust Damaged Stock
          </Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() =>
              router.push("/dashboard/office/wireman/inventory/damage/create")
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Report New Damage
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Damaged Stock
            </CardTitle>
            <Trash2 className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {Number(liveDamagedUnits).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Current live damaged units in warehouse</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Damaged Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
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

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Damage History</CardTitle>
              <CardDescription>
                Detailed log of internal product damages with stock values.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {zeroQtyCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCleanZeroQty}
                  disabled={isDeleting}
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Clean 0-Qty Logs ({zeroQtyCount})
                </Button>
              )}
              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Selected ({selectedIds.length})
                </Button>
              )}
              {damages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isDeleting}
                  className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  Clear All History
                </Button>
              )}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search report #, product, SKU..."
                  className="pl-9 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
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
              <p>No damage reports found for Wireman Agency.</p>
            </div>
          ) : (
            <>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-orange-50/50">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allCurrentPageSelected}
                          onCheckedChange={handleToggleSelectAll}
                          aria-label="Select all on page"
                        />
                      </TableHead>
                      <TableHead>Report #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Reason / Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Stock Value</TableHead>
                      <TableHead className="text-right">Reported By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                      const isSelected = selectedIds.includes(item.id);

                      return (
                        <TableRow
                          key={item.id}
                          className={isSelected ? "bg-orange-50/60" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectOne(item.id)}
                              aria-label={`Select ${item.return_number}`}
                            />
                          </TableCell>
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
                              <span className="font-medium">
                                {item.products?.name}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {item.products?.sku}
                              </span>
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
                          <TableCell className="text-right font-medium text-orange-950">
                            LKR {itemVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {item.profiles?.full_name || "Admin"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isDeleting}
                              onClick={() => handleDeleteSingle(item.id, item.return_number)}
                              className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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
