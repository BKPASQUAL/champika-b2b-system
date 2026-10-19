"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  RefreshCw,
  Factory,
  Plus,
  Eye,
  Copy,
  Printer,
  Download,
  Share2,
  Trash2,
  Calculator,
  MessageSquare,
  FileSpreadsheet,
  AlertCircle,
  FileCheck2,
  Calendar,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  copyEstimateItemsAsText,
  downloadPurchaseEstimatePdf,
  printPurchaseEstimate,
  shareViaWhatsApp,
} from "@/app/lib/purchase-estimate-print";

interface PurchaseEstimate {
  id: string;
  estimateNumber: string;
  businessId: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  referenceNo?: string;
  estimateDate: string;
  arrivalDate?: string;
  items: any[];
  itemsCount: number;
  totalQuantity: number;
  grossTotal: number;
  lineDiscountTotal: number;
  subTotal: number;
  extraDiscountPercent: number;
  extraDiscountAmount: number;
  totalAmount: number;
  status: "Saved" | "Finalized" | "Ordered" | "Cancelled";
  notes?: string;
  createdAt: string;
}

interface PurchaseEstimateListProps {
  businessId: string;
  businessName: string;
  baseRoute: string; // e.g. "/dashboard/office/orange/purchase-estimates"
  themeColor?: "orange" | "blue" | "emerald" | "slate";
}

const fmt = (val: number) =>
  new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);

export function PurchaseEstimateList({
  businessId,
  businessName,
  baseRoute,
  themeColor = "orange",
}: PurchaseEstimateListProps) {
  const router = useRouter();
  const [estimates, setEstimates] = useState<PurchaseEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const colorStyles = {
    orange: {
      primary: "bg-orange-600 hover:bg-orange-700 text-white",
      badge: "border-orange-200 text-orange-800 bg-orange-50",
      accent: "text-orange-600",
      header: "text-orange-950",
      border: "border-orange-200",
    },
    blue: {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      badge: "border-blue-200 text-blue-800 bg-blue-50",
      accent: "text-blue-600",
      header: "text-blue-950",
      border: "border-blue-200",
    },
    emerald: {
      primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
      badge: "border-emerald-200 text-emerald-800 bg-emerald-50",
      accent: "text-emerald-600",
      header: "text-emerald-950",
      border: "border-emerald-200",
    },
    slate: {
      primary: "bg-slate-800 hover:bg-slate-900 text-white",
      badge: "border-slate-200 text-slate-800 bg-slate-50",
      accent: "text-slate-700",
      header: "text-slate-950",
      border: "border-slate-200",
    },
  }[themeColor];

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-estimates?businessId=${businessId}`);
      const data = await res.json();

      if (data?.code === "TABLE_NOT_FOUND") {
        setTableMissing(true);
        setEstimates([]);
        return;
      }

      if (!res.ok) throw new Error(data.error || "Failed to load estimates");
      setTableMissing(false);
      setEstimates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load purchase estimates");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEstimates();
  }, [businessId]);

  // Filtered
  const filteredEstimates = useMemo(() => {
    return estimates.filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.estimateNumber.toLowerCase().includes(q) ||
        e.supplierName.toLowerCase().includes(q) ||
        (e.referenceNo && e.referenceNo.toLowerCase().includes(q)) ||
        (e.items &&
          e.items.some(
            (it) =>
              it.productName?.toLowerCase().includes(q) ||
              it.sku?.toLowerCase().includes(q)
          ));

      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [estimates, searchQuery, statusFilter]);

  // Stats
  const totalAmountSum = useMemo(
    () => estimates.reduce((sum, e) => sum + (e.totalAmount || 0), 0),
    [estimates]
  );
  const savedCount = useMemo(
    () => estimates.filter((e) => e.status === "Saved").length,
    [estimates]
  );
  const finalizedCount = useMemo(
    () => estimates.filter((e) => e.status === "Finalized").length,
    [estimates]
  );

  const handleDelete = async (id: string, estNo: string) => {
    if (!confirm(`Are you sure you want to delete estimate ${estNo}?`)) return;
    try {
      const res = await fetch(`/api/purchase-estimates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete estimate");
      toast.success(`Estimate ${estNo} deleted`);
      setEstimates((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${colorStyles.header} flex items-center gap-2`}>
              Purchase Estimates <Calculator className={`w-7 h-7 ${colorStyles.accent}`} />
            </h1>
            <Badge variant="outline" className={colorStyles.badge}>
              Quotation / Planning
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {businessName} • Price calculations & supplier order planning (No stock changes)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchEstimates}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={() => router.push(`${baseRoute}/create`)}
            className={colorStyles.primary}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Estimate
          </Button>
        </div>
      </div>

      {/* SQL Migration Warning if Table Not Found */}
      {tableMissing && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 text-sm">
                  Database Table Setup Required
                </h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  The <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">purchase_estimates</code> table hasn&apos;t been created in Supabase yet. Run the migration script in Supabase SQL editor.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-900 hover:bg-amber-100 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(
                  `CREATE TABLE IF NOT EXISTS public.purchase_estimates (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  estimate_number TEXT UNIQUE NOT NULL,\n  business_id TEXT NOT NULL,\n  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,\n  supplier_name TEXT,\n  reference_no TEXT,\n  estimate_date DATE DEFAULT CURRENT_DATE,\n  arrival_date DATE,\n  items JSONB NOT NULL DEFAULT '[]'::jsonb,\n  gross_total NUMERIC(12, 2) DEFAULT 0,\n  line_discount_total NUMERIC(12, 2) DEFAULT 0,\n  sub_total NUMERIC(12, 2) DEFAULT 0,\n  extra_discount_percent NUMERIC(5, 2) DEFAULT 0,\n  extra_discount_amount NUMERIC(12, 2) DEFAULT 0,\n  total_amount NUMERIC(12, 2) DEFAULT 0,\n  status TEXT DEFAULT 'Saved' CHECK (status IN ('Saved', 'Finalized', 'Ordered', 'Cancelled')),\n  notes TEXT,\n  created_by TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);`
                );
                toast.success("SQL copied to clipboard! Paste and Run in Supabase SQL Editor.");
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1" /> Copy Migration SQL
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Quotation & Estimate Mode:</strong> Calculates total bill amounts and item discounts for planned orders. <em>Does not increment warehouse stock or create supplier liabilities.</em>
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Total Estimates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estimates.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Quotations created</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Total Planned Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              Rs. {fmt(totalAmountSum)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sum of all estimates</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Saved / Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{savedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Work in progress</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Finalized Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{finalizedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to send</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by estimate #, supplier, or product name..."
                className="pl-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Saved">Saved / Draft</SelectItem>
                  <SelectItem value="Finalized">Finalized</SelectItem>
                  <SelectItem value="Ordered">Ordered</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estimates Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[140px]">Estimate #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead className="text-center w-[90px]">Items</TableHead>
                <TableHead className="text-center w-[90px]">Total Qty</TableHead>
                <TableHead className="text-right w-[140px]">Est. Amount</TableHead>
                <TableHead className="text-center w-[110px]">Status</TableHead>
                <TableHead className="text-right w-[180px]">Quick Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading purchase estimates...
                  </TableCell>
                </TableRow>
              ) : filteredEstimates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Calculator className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-700">No purchase estimates found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click &quot;New Estimate&quot; above to calculate prices and plan an order.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEstimates.map((est) => {
                  const statusColors: Record<string, string> = {
                    Saved: "bg-slate-100 text-slate-700 border-slate-300",
                    Finalized: "bg-blue-100 text-blue-800 border-blue-300",
                    Ordered: "bg-green-100 text-green-800 border-green-300",
                    Cancelled: "bg-red-100 text-red-800 border-red-300",
                  };

                  return (
                    <TableRow key={est.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-mono font-bold text-slate-900">
                        {est.estimateNumber}
                        {est.referenceNo && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            Ref: {est.referenceNo}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {est.supplierName}
                        </div>
                        {est.supplierPhone && (
                          <div className="text-xs text-muted-foreground">
                            {est.supplierPhone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(est.estimateDate).toLocaleDateString("en-GB")}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium text-xs">
                        {est.itemsCount}
                      </TableCell>
                      <TableCell className="text-center font-medium text-xs text-slate-700">
                        {est.totalQuantity}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        Rs. {fmt(est.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[est.status] || "bg-slate-100"}`}
                        >
                          {est.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => router.push(`${baseRoute}/${est.id}`)}
                            title="View Estimate"
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </Button>

                          {/* Edit button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => router.push(`${baseRoute}/${est.id}/edit`)}
                            title="Edit Estimate"
                            className="text-slate-600 hover:text-blue-600"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          {/* Copy Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Copy Items & Qty"
                              >
                                <Copy className="w-4 h-4 text-blue-600" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem
                                onClick={() => copyEstimateItemsAsText(est, "whatsapp")}
                              >
                                <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                                <span>Copy for WhatsApp</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyEstimateItemsAsText(est, "bullet")}
                              >
                                <Copy className="w-4 h-4 mr-2 text-blue-600" />
                                <span>Copy Item Names & Qty</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyEstimateItemsAsText(est, "portal_tab")}
                              >
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-indigo-600" />
                                <span>Copy for Supplier Portal (Tab)</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* PDF Download */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => downloadPurchaseEstimatePdf(est)}
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4 text-emerald-600" />
                          </Button>

                          {/* Print */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => printPurchaseEstimate(est)}
                            title="Print"
                          >
                            <Printer className="w-4 h-4 text-slate-600" />
                          </Button>

                          {/* Share via WhatsApp */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => shareViaWhatsApp(est)}
                            title="Share on WhatsApp"
                          >
                            <Share2 className="w-4 h-4 text-green-600" />
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(est.id, est.estimateNumber)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
