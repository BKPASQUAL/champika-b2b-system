"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// --- Types ---
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

export default function DueAlertsPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");

  // --- Fetch Invoices & Calculate Overdue ---
  const fetchOverdueInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();

      const today = new Date();

      // Map and Filter for Overdue items only
      const mappedInvoices: OverdueInvoice[] = data
        .map((inv: any) => {
          // Determine Due Date (Fallback to 30 days after creation if not present)
          const createdDate = new Date(inv.createdAt);
          const dueDate = inv.dueDate
            ? new Date(inv.dueDate)
            : new Date(createdDate.setDate(createdDate.getDate() + 30));

          // Calculate Days Overdue
          const diffTime = today.getTime() - dueDate.getTime();
          const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          return {
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            customerName: inv.customerName || "Unknown",
            shopName: inv.customer?.shopName || inv.shopName || "-",
            phone: inv.customer?.phone || inv.phone || "",
            dueDate: dueDate.toISOString().split("T")[0],
            amount: inv.dueAmount || 0,
            daysOverdue: daysOverdue,
            status: inv.status,
          };
        })
        .filter((inv: OverdueInvoice) => inv.daysOverdue > 0 && inv.amount > 0); // Only show actual overdue items

      setInvoices(mappedInvoices);
    } catch (error) {
      console.error("Error fetching overdue invoices:", error);
      toast.error("Failed to load overdue alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverdueInvoices();
  }, [fetchOverdueInvoices]);

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

  // --- Stats Calculations ---
  const totalOverdue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const overdue30 = invoices
    .filter((inv) => inv.daysOverdue >= 30 && inv.daysOverdue < 60)
    .reduce((sum, inv) => sum + inv.amount, 0);
  const overdue60 = invoices
    .filter((inv) => inv.daysOverdue >= 60 && inv.daysOverdue < 90)
    .reduce((sum, inv) => sum + inv.amount, 0);
  const overdue90 = invoices
    .filter((inv) => inv.daysOverdue >= 90)
    .reduce((sum, inv) => sum + inv.amount, 0);

  // --- Badge Logic ---
  const getAgingBadge = (days: number) => {
    if (days >= 90) {
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white border-none animate-pulse">
          90+ Days
        </Badge>
      );
    }
    if (days >= 60) {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-none">
          60+ Days
        </Badge>
      );
    }
    if (days >= 30) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-none">
          30+ Days
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {days} Days
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Due Alerts <AlertTriangle className="text-red-500 h-6 w-6" />
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
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {(totalOverdue / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All outstanding bills
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">30+ Days</CardTitle>
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

        <Card className="border-l-4 border-l-orange-500 bg-orange-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">60+ Days</CardTitle>
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

        <Card className="border-l-4 border-l-red-600 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">90+ Days</CardTitle>
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
                <TableRow className="bg-muted/50">
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer / Shop</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-center">Aging</TableHead>
                  <TableHead className="text-right">Due Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex justify-center items-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">
                          Checking invoices...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
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
                  filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="hover:bg-red-50/10 transition-colors"
                    >
                      <TableCell className="font-medium font-mono">
                        {invoice.invoiceNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {invoice.shopName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.customerName}{" "}
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
                        <span className="font-bold text-red-600">
                          LKR {invoice.amount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {invoice.phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() =>
                                (window.location.href = `tel:${invoice.phone}`)
                              }
                            >
                              <Phone className="w-3 h-3 mr-1" /> Call
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/admin/invoices/${invoice.id}`
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
