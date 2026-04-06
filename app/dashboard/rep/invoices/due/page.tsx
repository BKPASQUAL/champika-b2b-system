"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Eye,
  AlertOctagon,
  CalendarDays,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

interface OverdueInvoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  phone: string;
  dueDate: string;
  amount: number;
  daysOverdue: number;
}

const getAgingBadge = (days: number) => {
  if (days >= 90)
    return (
      <Badge className="bg-red-600 hover:bg-red-700 text-white border-none animate-pulse">
        90+ Days
      </Badge>
    );
  if (days >= 60)
    return (
      <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-none">
        60+ Days
      </Badge>
    );
  if (days >= 30)
    return (
      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-none">
        30+ Days
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {days} Days
    </Badge>
  );
};

export default function RepDueInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");

  useEffect(() => {
    const fetchDueInvoices = async () => {
      let userId = "";
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) userId = JSON.parse(storedUser).id;
      }

      if (!userId) {
        toast.error("User not found. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/invoices?repId=${userId}`);
        if (!res.ok) throw new Error("Failed to fetch invoices");
        const data = await res.json();

        const now = new Date(); now.setHours(0, 0, 0, 0);

        const overdue = data
          .filter((inv: any) => {
            if (!inv.dueDate) return false;
            if (inv.dueAmount <= 0) return false;
            const due = new Date(inv.dueDate); due.setHours(0, 0, 0, 0);
            return due < now;
          })
          .map((inv: any) => {
            const due = new Date(inv.dueDate); due.setHours(0, 0, 0, 0);
            const daysOverdue = Math.round((now.getTime() - due.getTime()) / 86400000);
            return {
              id: inv.id,
              invoiceNo: inv.manualInvoiceNo || inv.invoiceNo,
              customerName: inv.customerName,
              phone: inv.phone || "N/A",
              dueDate: inv.dueDate,
              amount: inv.dueAmount,
              daysOverdue,
            };
          })
          .sort((a: OverdueInvoice, b: OverdueInvoice) => b.daysOverdue - a.daysOverdue);

        setInvoices(overdue);
      } catch (err) {
        console.error(err);
        toast.error("Error loading overdue invoices");
      } finally {
        setLoading(false);
      }
    };

    fetchDueInvoices();
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAge =
        ageFilter === "all" ||
        (ageFilter === "30+" && inv.daysOverdue >= 30) ||
        (ageFilter === "60+" && inv.daysOverdue >= 60) ||
        (ageFilter === "90+" && inv.daysOverdue >= 90);
      return matchesSearch && matchesAge;
    });
  }, [invoices, searchQuery, ageFilter]);

  const totalOverdue = invoices.reduce((s, i) => s + i.amount, 0);
  const overdue30 = invoices.filter((i) => i.daysOverdue >= 30 && i.daysOverdue < 60).reduce((s, i) => s + i.amount, 0);
  const overdue60 = invoices.filter((i) => i.daysOverdue >= 60 && i.daysOverdue < 90).reduce((s, i) => s + i.amount, 0);
  const overdue90 = invoices.filter((i) => i.daysOverdue >= 90).reduce((s, i) => s + i.amount, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-muted-foreground">Checking overdue bills...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-blue-900">
          Due Invoices <AlertTriangle className="text-red-500 h-6 w-6" />
        </h1>
        <p className="text-muted-foreground mt-1">Your overdue customer payments.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">LKR {totalOverdue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">30+ Days</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">LKR {overdue30.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Action required</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 bg-orange-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">60+ Days</CardTitle>
            <AlertOctagon className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">LKR {overdue60.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Serious concern</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-600 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">90+ Days</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">LKR {overdue90.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Critical status</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
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
            <Select value={ageFilter} onValueChange={setAgeFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter by Age" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Overdue</SelectItem>
                <SelectItem value="30+">30+ Days</SelectItem>
                <SelectItem value="60+">60+ Days</SelectItem>
                <SelectItem value="90+">90+ Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-center">Aging</TableHead>
                  <TableHead className="text-right">Due Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <CheckCircle2 className="h-10 w-10 text-green-400" />
                        <p>No overdue invoices found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-red-50/10">
                      <TableCell className="font-medium font-mono text-sm">
                        {inv.invoiceNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{inv.customerName}</span>
                          {inv.phone !== "N/A" && (
                            <span className="text-xs text-muted-foreground">{inv.phone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(inv.dueDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getAgingBadge(inv.daysOverdue)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        LKR {inv.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => router.push(`/dashboard/rep/invoices/${inv.id}`)}
                        >
                          <Eye className="w-3 h-3" /> View
                        </Button>
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
