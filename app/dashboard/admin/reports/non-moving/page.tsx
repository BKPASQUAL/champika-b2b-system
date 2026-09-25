"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  PackageX,
  Calendar,
  Download,
  Search,
  RefreshCw,
  ArrowLeft,
  Factory,
  Boxes,
  Wallet,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtCurr = (n: number) =>
  "LKR " + n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getQuickRange(quickSelect: string, customFrom: string, customTo: string) {
  const now = new Date();
  let from: Date, to: Date;
  switch (quickSelect) {
    case "this-month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date();
      break;
    case "last-3-months":
      from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case "custom":
      from = new Date(customFrom);
      to = new Date(customTo);
      break;
    case "last-month":
    default:
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
  }
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default function NonMovingItemsReportPage() {
  const [loading, setLoading] = useState(true);
  const [quickPeriod, setQuickPeriod] = useState("last-month");
  const [customFrom, setCustomFrom] = useState(getQuickRange("last-month", "", "").from);
  const [customTo, setCustomTo] = useState(getQuickRange("last-month", "", "").to);
  const [search, setSearch] = useState("");

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({
    supplierCount: 0,
    productCount: 0,
    totalStockQty: 0,
    totalStockCostValue: 0,
    totalStockSellingValue: 0,
  });
  const [rangeUsed, setRangeUsed] = useState<{ from: string; to: string } | null>(null);

  const { from, to } = useMemo(
    () => getQuickRange(quickPeriod, customFrom, customTo),
    [quickPeriod, customFrom, customTo]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/non-moving?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch non-moving items report");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuppliers(data.suppliers || []);
      setTotals(
        data.totals || {
          supplierCount: 0,
          productCount: 0,
          totalStockQty: 0,
          totalStockCostValue: 0,
          totalStockSellingValue: 0,
        }
      );
      setRangeUsed({ from: data.fromDate, to: data.toDate });
    } catch (err: any) {
      toast.error("Failed to load non-moving items report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Filter products within each supplier by search, dropping suppliers left with nothing
  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers
      .map((s) => ({
        ...s,
        products: s.products.filter(
          (p: any) =>
            p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.products.length > 0);
  }, [suppliers, search]);

  const handleExportCSV = () => {
    const headers = [
      "Supplier",
      "Product Name",
      "SKU",
      "Category",
      "Stock Qty",
      "Cost Price (LKR)",
      "Selling Price (LKR)",
      "Stock Cost Value (LKR)",
      "Stock Selling Value (LKR)",
      "Last Sold Date",
      "Days Since Last Sale",
    ];

    const rows: any[] = [];
    filteredSuppliers.forEach((s) => {
      s.products.forEach((p: any) => {
        rows.push([
          `"${s.name.replace(/"/g, '""')}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          p.sku,
          p.category,
          p.stockQty,
          p.costPrice.toFixed(2),
          p.sellingPrice.toFixed(2),
          p.stockCostValue.toFixed(2),
          p.stockSellingValue.toFixed(2),
          p.lastSoldDate || "Never",
          p.daysSinceLastSale ?? "-",
        ]);
      });
    });

    const csvContent =
      "data:text/csv;charset=utf-8,﻿" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Non_Moving_Items_${from}_to_${to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export download started!");
  };

  const handlePrintPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const marginLeft = 14;
      const marginRight = pageWidth - 14;

      const drawPageHeader = () => {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("CHAMPIKA HARDWARE", pageWidth / 2, 14, { align: "center" });

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Pranawatta Road, Wallabada, Boossa  |  Tel: 0777681663", pageWidth / 2, 19, {
          align: "center",
        });

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(marginLeft, 23, marginRight, 23);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("NON-MOVING ITEMS REPORT", pageWidth / 2, 29, { align: "center" });

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(`Period: ${from} to ${to}`, marginLeft, 35);
        doc.text(`Suppliers Affected: ${totals.supplierCount}`, marginRight, 35, {
          align: "right",
        });
        const capitalStr = totals.totalStockCostValue.toLocaleString("en-LK", {
          minimumFractionDigits: 2,
        });
        doc.text(`Capital Tied Up: LKR ${capitalStr}`, marginRight, 39, { align: "right" });

        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, 42, marginRight, 42);
      };

      const drawPageFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(130, 130, 130);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 8, {
          align: "center",
        });
        doc.text("Champika Hardware — Confidential", marginLeft, pageHeight - 8);
      };

      drawPageHeader();

      const tableRows: any[] = [];
      filteredSuppliers.forEach((s) => {
        s.products.forEach((p: any) => {
          tableRows.push([
            s.name,
            p.sku || "-",
            p.name,
            p.category || "-",
            fmt(p.stockQty),
            p.costPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
            p.stockCostValue.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
            p.lastSoldDate || "Never",
            p.daysSinceLastSale ?? "-",
          ]);
        });
      });

      autoTable(doc, {
        head: [
          [
            "Supplier",
            "SKU",
            "Item Name",
            "Category",
            "Stock",
            "Unit Cost",
            "Stock Value (LKR)",
            "Last Sold",
            "Days Idle",
          ],
        ],
        body: tableRows,
        foot: [
          [
            "",
            "",
            "",
            "Total",
            fmt(totals.totalStockQty),
            "",
            totals.totalStockCostValue.toLocaleString("en-LK", { minimumFractionDigits: 2 }),
            "",
            "",
          ],
        ],
        startY: 46,
        theme: "striped",
        margin: { top: 46, left: marginLeft, right: marginLeft },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
          valign: "middle",
        },
        bodyStyles: {
          textColor: [30, 30, 30],
          fontSize: 8,
          valign: "middle",
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 8,
          valign: "middle",
        },
        columnStyles: {
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right", fontStyle: "bold" },
          8: { halign: "right" },
        },
        didDrawPage: () => {
          drawPageHeader();
        },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawPageFooter(i, totalPages);
      }

      doc.save(`Non_Moving_Items_${from}_to_${to}.pdf`);
      toast.success("PDF report downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs and Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/dashboard/admin/reports"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Reports
            </Link>
            <span>/</span>
            <span className="text-foreground">Non-Moving Items</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Non-Moving Items Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Items still in stock with zero sales in the selected period, grouped by supplier.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="h-9 border-gray-200"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handlePrintPDF}
            variant="outline"
            size="sm"
            className="h-9 border-gray-200"
            disabled={loading || totals.productCount === 0}
          >
            <Printer className="h-4 w-4 mr-2 text-rose-500" />
            Download PDF
          </Button>
          <Button
            onClick={handleExportCSV}
            variant="default"
            size="sm"
            className="h-9 bg-primary hover:bg-primary/95 text-white"
            disabled={loading || totals.productCount === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border border-gray-100 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Period
              </label>
              <Select value={quickPeriod} onValueChange={setQuickPeriod}>
                <SelectTrigger className="w-full bg-white border border-gray-200">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-month">This Month (so far)</SelectItem>
                  <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              {rangeUsed && (
                <span className="text-[10px] text-muted-foreground block mt-1">
                  Showing: {rangeUsed.from} to {rangeUsed.to}
                </span>
              )}
            </div>

            {quickPeriod === "custom" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    From
                  </label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    To
                  </label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 border-gray-200"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Search Item
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 border-gray-200"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Suppliers Affected
              </p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1">
                {totals.supplierCount}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                with non-moving stock
              </p>
            </div>
            <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Factory className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Non-Moving Products
              </p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1">
                {totals.productCount}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                zero sales in period
              </p>
            </div>
            <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
              <PackageX className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stock Sitting Idle
              </p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-1">
                {fmt(totals.totalStockQty)}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">units in warehouse</p>
            </div>
            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-primary/20 shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Capital Tied Up
              </p>
              <h3 className="text-xl font-black text-gray-900 mt-1">
                {fmtCurr(totals.totalStockCostValue)}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">at cost price</p>
            </div>
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Supplier Breakdown */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-gray-100">
          <CardTitle className="text-base font-bold text-gray-800">
            Non-Moving Items by Supplier
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each supplier is listed separately with the items that had no qualifying sales in
            the selected period.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-20 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
              Loading non-moving items report...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              No non-moving items found for this period.
            </div>
          ) : (
            <Accordion type="multiple" className="px-6" defaultValue={[filteredSuppliers[0]?.name]}>
              {filteredSuppliers.map((s) => (
                <AccordionItem key={s.name} value={s.name}>
                  <AccordionTrigger>
                    <div className="flex flex-1 items-center justify-between pr-2">
                      <div className="flex items-center gap-2">
                        <Factory className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold text-sm text-gray-900">{s.name}</span>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-transparent">
                          {s.productCount} item{s.productCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{fmt(s.totalStockQty)} units idle</span>
                        <span className="font-bold text-gray-800">
                          {fmtCurr(s.totalStockCostValue)}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                      <Table>
                        <TableHeader className="bg-gray-50/50">
                          <TableRow>
                            <TableHead className="text-xs font-semibold">Product</TableHead>
                            <TableHead className="text-xs font-semibold">Category</TableHead>
                            <TableHead className="text-right text-xs font-semibold">
                              Stock Qty
                            </TableHead>
                            <TableHead className="text-right text-xs font-semibold">
                              Stock Value (Cost)
                            </TableHead>
                            <TableHead className="text-right text-xs font-semibold">
                              Stock Value (Selling)
                            </TableHead>
                            <TableHead className="text-xs font-semibold">Last Sold</TableHead>
                            <TableHead className="text-right text-xs font-semibold">
                              Days Idle
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {s.products.map((p: any) => (
                            <TableRow key={p.id} className="hover:bg-gray-50/30">
                              <TableCell className="py-3">
                                <span className="text-xs font-semibold text-gray-900 block">
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  SKU: {p.sku || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-gray-600 py-3">
                                {p.category || "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium py-3">
                                {fmt(p.stockQty)}
                              </TableCell>
                              <TableCell className="text-right text-xs py-3">
                                {fmt(p.stockCostValue)}
                              </TableCell>
                              <TableCell className="text-right text-xs py-3">
                                {fmt(p.stockSellingValue)}
                              </TableCell>
                              <TableCell className="text-xs py-3">
                                {p.lastSoldDate || (
                                  <span className="text-gray-400 italic">Never sold</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs py-3">
                                {p.daysSinceLastSale !== null ? (
                                  <Badge
                                    variant="secondary"
                                    className={
                                      p.daysSinceLastSale > 90
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }
                                  >
                                    {fmt(p.daysSinceLastSale)}d
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
