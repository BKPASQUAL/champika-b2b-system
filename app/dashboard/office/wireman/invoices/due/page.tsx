"use client";

import React, { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
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
  Search,
  Filter,
  AlertTriangle,
  Clock,
  Phone,
  Eye,
  AlertOctagon,
  CalendarDays,
  ArrowUpRight,
  CreditCard,
  RefreshCw,
  Printer,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Types ---
interface OverdueInvoice {
  id: string;
  orderId: string;
  invoiceNo: string;
  customerName: string;
  shopName: string;
  phone: string;
  invoiceDate: string;
  dueAmount: number;
  daysOverdue: number;
  status: string;
}

export default function WiremanDueAlertsPage() {
  const router = useRouter();
  const [currentBusinessId] = useState<string>(BUSINESS_IDS.WIREMAN_AGENCY);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");

  const {
    data: rawInvoices = [],
    loading,
    refetch: fetchOverdueInvoices,
  } = useCachedFetch<any[]>(
    `/api/invoices?businessId=${currentBusinessId}`,
    [],
    () => toast.error("Failed to load overdue alerts")
  );

  const invoices: OverdueInvoice[] = useMemo(() => {
    const today = new Date();
    return rawInvoices
      .map((inv: any) => {
        const createdDate = new Date(inv.date || inv.createdAt);
        const diffTime = today.getTime() - createdDate.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return {
          id: inv.id,
          orderId: inv.orderId || inv.id,
          invoiceNo: inv.invoiceNo,
          customerName: inv.customerName || "Unknown",
          shopName: inv.customer?.shopName || inv.shopName || "",
          phone: inv.customer?.phone || inv.phone || "",
          invoiceDate: createdDate.toISOString().split("T")[0],
          dueAmount: inv.dueAmount || 0,
          daysOverdue,
          status: inv.status,
        };
      })
      .filter((inv: OverdueInvoice) => inv.daysOverdue > 0 && inv.dueAmount > 0);
  }, [rawInvoices]);

  // --- Filter Logic ---
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesAge = true;
    if (ageFilter === "30+") matchesAge = inv.daysOverdue >= 30;
    if (ageFilter === "60+") matchesAge = inv.daysOverdue >= 60;
    if (ageFilter === "90+") matchesAge = inv.daysOverdue >= 90;

    return matchesSearch && matchesAge;
  });

  // Sort by aging (most overdue first)
  const sortedInvoices = [...filteredInvoices].sort(
    (a, b) => b.daysOverdue - a.daysOverdue,
  );

  // --- Stats Calculations ---
  const totalOverdue = invoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
  const overdue30 = invoices
    .filter((inv) => inv.daysOverdue >= 30 && inv.daysOverdue < 60)
    .reduce((sum, inv) => sum + inv.dueAmount, 0);
  const overdue60 = invoices
    .filter((inv) => inv.daysOverdue >= 60 && inv.daysOverdue < 90)
    .reduce((sum, inv) => sum + inv.dueAmount, 0);
  const overdue90 = invoices
    .filter((inv) => inv.daysOverdue >= 90)
    .reduce((sum, inv) => sum + inv.dueAmount, 0);

  // --- Badge Logic ---
  const getAgingBadge = (days: number) => {
    if (days >= 90) {
      return (
        <Badge className="bg-red-100 hover:bg-red-200 text-red-700 border-none justify-center px-2 py-1">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {days} days
        </Badge>
      );
    }
    if (days >= 60) {
      return (
        <Badge className="bg-orange-100 hover:bg-orange-200 text-orange-700 border-none justify-center px-2 py-1">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {days} days
        </Badge>
      );
    }
    if (days >= 30) {
      return (
        <Badge className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border-none justify-center px-2 py-1">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {days} days
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-700 border-none justify-center px-2 py-1">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {days} days
      </Badge>
    );
  };

  const handlePrintReport = () => {
    try {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.text("Wireman Distribution", 14, 20);

      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38);
      doc.text("Outstanding Bills (Grouped by Customer)", 14, 28);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Generated: ${new Date().toLocaleDateString()}, ${new Date().toLocaleTimeString()}`,
        14,
        34,
      );
      doc.text(`Total Outstanding Bills: ${sortedInvoices.length}`, 14, 40);

      // Group Invoices by Customer
      const groupedInvoices: { [key: string]: OverdueInvoice[] } = {};
      sortedInvoices.forEach((inv) => {
        const customerKey = inv.shopName
          ? `${inv.shopName} - ${inv.customerName}`
          : inv.customerName;
        if (!groupedInvoices[customerKey]) {
          groupedInvoices[customerKey] = [];
        }
        groupedInvoices[customerKey].push(inv);
      });

      // Sort Customer Keys Alphabetically
      const sortedCustomerKeys = Object.keys(groupedInvoices).sort((a, b) =>
        a.localeCompare(b),
      );

      // Build Table Data with Group Headers
      const tableData: any[] = [];

      sortedCustomerKeys.forEach((customerKey) => {
        const customerInvoices = groupedInvoices[customerKey];
        const customerTotalDue = customerInvoices.reduce(
          (sum, inv) => sum + inv.dueAmount,
          0,
        );

        // Add Customer Header Row
        tableData.push([
          {
            content: `${customerKey} (Total Due: LKR ${customerTotalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
            colSpan: 5,
            styles: {
              fillColor: [240, 240, 240], // Light Gray Background
              textColor: [50, 50, 50],
              fontStyle: "bold",
              halign: "left",
            },
          },
        ]);

        // Add Invoice Rows
        customerInvoices.forEach((inv) => {
          tableData.push([
            new Date(inv.invoiceDate).toLocaleDateString(),
            inv.invoiceNo,
            inv.dueAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }), // This is the "Total" in the screenshot
            "0", // Paid Amount is 0 for these overdue invoices
            inv.dueAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }), // Due Amount
            "UNPAID", // Status
          ]);
        });
      });

      autoTable(doc, {
        startY: 45,
        head: [
          [
            "Date",
            "Invoice No",
            "Total (LKR)",
            "Paid (LKR)",
            "Due (LKR)",
            "Status",
          ],
        ],
        body: tableData,
        theme: "plain",
        headStyles: {
          fillColor: [220, 38, 38], // Red theme
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
        },
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "center" },
        },
        didParseCell: function (data) {
          // If it's a customer header row, align it correctly
          const rawRow = data.row.raw as any[];
          if (rawRow && rawRow[0] && rawRow[0].colSpan === 5) {
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.textColor = [50, 50, 50];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      doc.save("Due_Invoices_Report.pdf");
      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-red-900">
            Due Alerts <AlertTriangle className="text-red-600 h-6 w-6" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage overdue customer payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchOverdueInvoices}
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            className="hidden md:flex bg-white"
            onClick={handlePrintReport}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Overdue
            </CardTitle>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              LKR {(totalOverdue / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All outstanding bills
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              30+ Days
            </CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">
              LKR {(overdue30 / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Action required
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 bg-orange-50/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              60+ Days
            </CardTitle>
            <AlertOctagon className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              LKR {(overdue60 / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Serious concern
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-600 bg-red-50/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              90+ Days
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              LKR {(overdue90 / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Critical status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoice or customer..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={ageFilter} onValueChange={setAgeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Age" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Overdue</SelectItem>
                  <SelectItem value="30+">30+ Days</SelectItem>
                  <SelectItem value="60+">60+ Days</SelectItem>
                  <SelectItem value="90+">90+ Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-red-50/50">
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead className="text-center">Days Overdue</TableHead>
                  <TableHead className="text-right">Due Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500/20 mb-4" />
                        <p>No overdue invoices found matching your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="hover:bg-red-50/10 transition-colors"
                    >
                      <TableCell className="font-medium font-mono text-xs text-muted-foreground">
                        {invoice.invoiceNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {invoice.shopName || invoice.customerName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.shopName ? invoice.customerName : ""}
                            {invoice.phone ? ` • ${invoice.phone}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(invoice.invoiceDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getAgingBadge(invoice.daysOverdue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-red-600">
                          LKR {invoice.dueAmount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {invoice.phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8"
                              onClick={() =>
                                (window.location.href = `tel:${invoice.phone}`)
                              }
                              title="Call Customer"
                            >
                              <Phone className="w-3 h-3 mr-1" /> Call
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              router.push(
                                `/dashboard/office/wireman/invoices/${invoice.id}`,
                              )
                            }
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
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

// Helper Component for Empty State
function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide lucide-check-circle-2", className)}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
