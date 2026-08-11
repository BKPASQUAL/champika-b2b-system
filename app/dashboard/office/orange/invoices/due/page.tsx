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
  RefreshCw,
  Printer,
  Download,
  Loader2,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { toast } from "sonner";
import { downloadOutstandingReport, printOutstandingReport } from "../outstanding-report";

interface OverdueInvoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  shopName: string;
  phone: string;
  dueDate: string;
  amount: number;
  daysOverdue: number;
  status: string;
}

export default function OrangeDueAlertsPage() {
  const router = useRouter();
  const [currentBusinessId] = useState<string>(BUSINESS_IDS.ORANGE_AGENCY);

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
      .filter((inv: any) => inv.orderStatus === "Delivered")
      .map((inv: any) => {
        const createdDate = new Date(inv.date || inv.createdAt);
        const diffTime = today.getTime() - createdDate.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return {
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          customerName: inv.customerName || "Unknown",
          shopName: inv.customer?.shopName || inv.shopName || "",
          phone: inv.customer?.phone || inv.phone || "",
          dueDate: createdDate.toISOString().split("T")[0],
          amount: inv.dueAmount || 0,
          daysOverdue,
          status: inv.status,
        };
      })
      .filter((inv: OverdueInvoice) => inv.daysOverdue > 0 && inv.amount > 0);
  }, [rawInvoices]);

  // Filter Logic: 45+, 60+, 90+
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesAge = true;
    if (ageFilter === "45+") matchesAge = inv.daysOverdue >= 45;
    if (ageFilter === "60+") matchesAge = inv.daysOverdue >= 60;
    if (ageFilter === "90+") matchesAge = inv.daysOverdue >= 90;

    return matchesSearch && matchesAge;
  });

  const sortedInvoices = [...filteredInvoices].sort(
    (a, b) => b.daysOverdue - a.daysOverdue
  );

  // Stats Calculations (45+, 60+, 90+)
  const totalOverdue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const overdue45 = invoices
    .filter((inv) => inv.daysOverdue >= 45 && inv.daysOverdue < 60)
    .reduce((sum, inv) => sum + inv.amount, 0);
  const overdue60 = invoices
    .filter((inv) => inv.daysOverdue >= 60 && inv.daysOverdue < 90)
    .reduce((sum, inv) => sum + inv.amount, 0);
  const overdue90 = invoices
    .filter((inv) => inv.daysOverdue >= 90)
    .reduce((sum, inv) => sum + inv.amount, 0);

  // 3 Color Themes + New 90+ Days Critical Icon
  const getAgingBadge = (days: number) => {
    if (days >= 90) {
      return (
        <Badge className="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 font-bold justify-center px-2.5 py-1 animate-pulse">
          <Flame className="w-3.5 h-3.5 mr-1 text-red-600 fill-red-500" />
          <AlertOctagon className="w-3.5 h-3.5 mr-1 text-red-600" />
          {days} Days (90+ Critical)
        </Badge>
      );
    }
    if (days >= 60) {
      return (
        <Badge className="bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 justify-center px-2.5 py-1">
          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-orange-600" />
          {days} Days (60+)
        </Badge>
      );
    }
    if (days >= 45) {
      return (
        <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 justify-center px-2.5 py-1">
          <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
          {days} Days (45+)
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground justify-center px-2.5 py-1">
        <Clock className="w-3.5 h-3.5 mr-1" />
        {days} Days
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-orange-900">
            Due Alerts <AlertTriangle className="text-red-500 h-6 w-6" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage overdue customer payments (Orange Agency).
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
            className="bg-white"
            onClick={() => downloadOutstandingReport(rawInvoices as any)}
          >
            <Download className="w-4 h-4 mr-2 text-orange-600" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => printOutstandingReport(rawInvoices as any)}
          >
            <Printer className="w-4 h-4 mr-2 text-orange-600" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outstanding
            </CardTitle>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              LKR {(totalOverdue / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All {invoices.length} outstanding bills
            </p>
          </CardContent>
        </Card>

        {/* 45+ Days Card - Amber Theme */}
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">
              45+ Days Overdue
            </CardTitle>
            <Clock className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              LKR {(overdue45 / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-amber-800 mt-1 font-medium">
              Amber Theme • Action required
            </p>
          </CardContent>
        </Card>

        {/* 60+ Days Card - Orange Theme */}
        <Card className="border-l-4 border-l-orange-500 bg-orange-50/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">
              60+ Days Overdue
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              LKR {(overdue60 / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-orange-800 mt-1 font-medium">
              Orange Theme • High concern
            </p>
          </CardContent>
        </Card>

        {/* 90+ Days Card - Dark Red Critical Theme */}
        <Card className="border-l-4 border-l-red-600 bg-red-50/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-red-900 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-600 fill-red-500" />
              90+ Days Critical
            </CardTitle>
            <AlertOctagon className="w-4 h-4 text-red-600 animate-bounce" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-700">
              LKR {(overdue90 / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-red-800 mt-1 font-bold flex items-center gap-1">
              🚨 Critical Alert • Urgent Action Required
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
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Filter by Aging" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outstanding</SelectItem>
                  <SelectItem value="45+">45+ Days Overdue</SelectItem>
                  <SelectItem value="60+">60+ Days Overdue</SelectItem>
                  <SelectItem value="90+">🚨 90+ Days Critical</SelectItem>
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
                <TableRow className="bg-orange-50/50">
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead className="text-center">Aging & Theme</TableHead>
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
                      className={cn(
                        "hover:bg-orange-50/20 transition-colors",
                        invoice.daysOverdue >= 90 && "bg-red-50/30 font-medium"
                      )}
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
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getAgingBadge(invoice.daysOverdue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-orange-600">
                          LKR {invoice.amount.toLocaleString()}
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
                                `/dashboard/office/orange/invoices/${invoice.id}`
                              )
                            }
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
