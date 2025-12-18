"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Search,
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  DollarSign,
  Truck,
  CheckCircle2,
  FileText, // Icon for PDF
  Sheet, // Icon for Excel
  Download, // Icon for Download
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// --- Import Export Libraries ---
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function SupplierDamagePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [unpaidPurchases, setUnpaidPurchases] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const rawId = params?.id;
  const supplierId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (supplierId) {
      fetchSupplierDamages();
    }
  }, [supplierId]);

  const fetchSupplierDamages = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/suppliers/${supplierId}/damage`);
      if (!res.ok) throw new Error("Failed to load damage history");
      const jsonData = await res.json();
      setData(jsonData);
    } catch (error) {
      console.error(error);
      toast.error("Error loading damage data");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnpaidPurchases = async () => {
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`);
      if (res.ok) {
        const json = await res.json();
        const unpaid = json.purchases.filter(
          (p: any) => p.payment_status !== "Paid"
        );
        setUnpaidPurchases(unpaid);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.supplier) {
    return <div className="p-8 text-center">Supplier not found.</div>;
  }

  const { supplier, damages } = data;

  // Filter Logic
  const activeDamages = damages.filter(
    (d: any) => !d.reason?.includes("[CLAIMED]")
  );

  const filteredDamages = activeDamages.filter(
    (item: any) =>
      item.products?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.return_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locations?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Calculations ---
  const totalQty = activeDamages.reduce(
    (acc: number, item: any) => acc + (Number(item.quantity) || 0),
    0
  );

  const totalValue = activeDamages.reduce((acc: number, item: any) => {
    return (
      acc +
      (Number(item.quantity) || 0) * (Number(item.products?.cost_price) || 0)
    );
  }, 0);

  // --- Export Functions ---

  const generatePDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text(`${supplier.name} - Damage Report`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 14, 26);
    doc.text(`Total Damage Value: Rs. ${totalValue.toLocaleString()}`, 14, 32);

    // Table Data
    const tableData = filteredDamages.map((item: any, index: number) => {
      const cost = Number(item.products?.cost_price) || 0;
      const val = (Number(item.quantity) || 0) * cost;
      return [
        index + 1,
        format(new Date(item.created_at), "yyyy-MM-dd"),
        item.return_number,
        item.products?.name,
        item.locations?.name || "-",
        item.quantity,
        cost.toLocaleString(),
        val.toLocaleString(),
        item.reason || "-",
      ];
    });

    autoTable(doc, {
      head: [
        [
          "#",
          "Date",
          "Report No",
          "Product",
          "Location",
          "Qty",
          "Cost",
          "Total Value",
          "Reason",
        ],
      ],
      body: tableData,
      startY: 40,
      headStyles: { fillColor: [220, 38, 38] }, // Red header
      columnStyles: {
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right", fontStyle: "bold" },
      },
    });

    doc.save(`${supplier.name}_Damage_Report.pdf`);
  };

  const generateExcel = () => {
    const worksheetData = filteredDamages.map((item: any) => {
      const cost = Number(item.products?.cost_price) || 0;
      const val = (Number(item.quantity) || 0) * cost;

      return {
        Date: format(new Date(item.created_at), "yyyy-MM-dd"),
        "Report No": item.return_number,
        "Product Name": item.products?.name,
        "Product SKU": item.products?.sku,
        Location: item.locations?.name || "Unknown",
        Quantity: Number(item.quantity),
        "Unit Cost": cost,
        "Total Value": val,
        Reason: item.reason || "-",
        "Reported By": item.profiles?.full_name || "System",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Damage Report");
    XLSX.writeFile(workbook, `${supplier.name}_Damage_Report.xlsx`);
  };

  // --- Handlers ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredDamages.map((d: any) => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) setSelectedIds([...selectedIds, id]);
    else setSelectedIds(selectedIds.filter((sid) => sid !== id));
  };

  const getSelectedValue = () => {
    return activeDamages
      .filter((d: any) => selectedIds.includes(d.id))
      .reduce(
        (acc: number, item: any) =>
          acc +
          (Number(item.quantity) || 0) *
            (Number(item.products?.cost_price) || 0),
        0
      );
  };

  const openClaimDialog = () => {
    fetchUnpaidPurchases();
    setAllocations({});
    setIsClaimDialogOpen(true);
  };

  const handleAllocate = (purchaseId: string, dueAmount: number) => {
    const totalCredit = getSelectedValue();
    const currentAllocated = Object.values(allocations).reduce(
      (a, b) => a + b,
      0
    );
    const remainingCredit = totalCredit - currentAllocated;

    if (allocations[purchaseId]) {
      const newAlloc = { ...allocations };
      delete newAlloc[purchaseId];
      setAllocations(newAlloc);
      return;
    }

    if (remainingCredit <= 0)
      return toast.error("No remaining credit to allocate");

    const amountToAllocate = Math.min(remainingCredit, dueAmount);
    setAllocations({ ...allocations, [purchaseId]: amountToAllocate });
  };

  const submitClaim = async () => {
    const totalAllocated = Object.values(allocations).reduce(
      (a, b) => a + b,
      0
    );

    if (totalAllocated === 0)
      return toast.error("Please allocate credit to at least one bill");

    setSubmitting(true);
    try {
      const payload = {
        supplierId,
        damageItemIds: selectedIds,
        allocations: Object.entries(allocations).map(
          ([purchaseId, amount]) => ({ purchaseId, amount })
        ),
      };

      const res = await fetch("/api/suppliers/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }

      toast.success("Return processed and credit applied!");
      setIsClaimDialogOpen(false);
      setSelectedIds([]);
      fetchSupplierDamages();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {supplier.name} - Damage History
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage returns and claim credits for damaged stock.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {selectedIds.length > 0 ? (
            <Button
              onClick={openClaimDialog}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Truck className="w-4 h-4 mr-2" />
              Return & Claim (Rs. {getSelectedValue().toLocaleString()})
            </Button>
          ) : (
            <>
              {/* Export Buttons */}
              <Button variant="outline" onClick={generatePDF}>
                <FileText className="w-4 h-4 mr-2 text-red-500" /> PDF
              </Button>
              <Button variant="outline" onClick={generateExcel}>
                <Sheet className="w-4 h-4 mr-2 text-green-600" /> Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDamages.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending Resolution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Damaged Stock Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Rs. {totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Available for Claim
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Damage Records
            </CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredDamages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No actionable damage records found.</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedIds.length === filteredDamages.length &&
                          filteredDamages.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Report #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDamages.map((item: any) => {
                    const itemCost = Number(item.products?.cost_price) || 0;
                    const itemValue = (Number(item.quantity) || 0) * itemCost;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={(c) =>
                              handleSelectOne(item.id, !!c)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {item.return_number}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(item.created_at), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {item.products?.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.products?.sku}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {item.locations?.name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {itemValue > 0
                            ? `Rs. ${itemValue.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className="border-red-200 text-red-600"
                          >
                            Pending Return
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim Dialog */}
      <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Return Items & Claim Credit</DialogTitle>
            <CardDescription>
              Sending {selectedIds.length} items back to supplier. Total Credit:{" "}
              <span className="text-green-600 font-bold">
                Rs. {getSelectedValue().toLocaleString()}
              </span>
            </CardDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <h4 className="text-sm font-medium">
              Allocate Credit to Unpaid Bills
            </h4>
            {unpaidPurchases.length === 0 ? (
              <div className="p-4 bg-muted rounded-md text-center text-sm text-muted-foreground">
                No unpaid bills found. Credit will be applied to account balance
                only.
              </div>
            ) : (
              <div className="border rounded-md max-h-[250px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead className="text-right">Due Amount</TableHead>
                      <TableHead className="text-right">Allocate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidPurchases.map((po) => {
                      const due =
                        Number(po.total_amount) - Number(po.paid_amount);
                      const isSelected = !!allocations[po.id];
                      return (
                        <TableRow key={po.id}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleAllocate(po.id, due)}
                            />
                          </TableCell>
                          <TableCell>{po.purchase_id}</TableCell>
                          <TableCell className="text-right">
                            Rs. {due.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {isSelected
                              ? `Rs. ${allocations[po.id].toLocaleString()}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between items-center text-sm px-2">
              <span>Total Allocated:</span>
              <span
                className={
                  Object.values(allocations).reduce((a, b) => a + b, 0) >
                  getSelectedValue()
                    ? "text-red-500 font-bold"
                    : "font-bold"
                }
              >
                Rs.{" "}
                {Object.values(allocations)
                  .reduce((a, b) => a + b, 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsClaimDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={submitClaim} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirm Return & Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
