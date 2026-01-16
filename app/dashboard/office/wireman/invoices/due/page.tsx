"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  AlertTriangle,
  Phone,
  Eye,
  CalendarDays,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { toast } from "sonner";
import { RecordPaymentDialog } from "../_components/RecordPaymentDialog";

// --- Types ---
interface OverdueInvoice {
  id: string;
  orderId: string;
  invoiceNo: string;
  customerName: string;
  shopName: string;
  phone: string;
  dueDate: string;
  dueAmount: number; // ✅ Renamed from 'amount' to 'dueAmount'
  daysOverdue: number;
  status: string;
}

export default function WiremanDueInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(
    null
  );

  // Dialog State
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<OverdueInvoice | null>(
    null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user && user.businessId) {
      setCurrentBusinessId(user.businessId);
    }
  }, []);

  const fetchOverdueInvoices = useCallback(async () => {
    if (!currentBusinessId) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/invoices?businessId=${currentBusinessId}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();

      const today = new Date();

      const mappedInvoices: OverdueInvoice[] = data
        .map((inv: any) => {
          // Determine Due Date
          const createdDate = new Date(inv.createdAt);
          const dueDate = inv.dueDate
            ? new Date(inv.dueDate)
            : new Date(createdDate.setDate(createdDate.getDate() + 30));

          // Calculate Days Overdue
          const diffTime = today.getTime() - dueDate.getTime();
          const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          return {
            id: inv.id,
            orderId: inv.orderId || inv.id,
            invoiceNo: inv.invoiceNo,
            customerName: inv.customerName || "Unknown",
            shopName: inv.customer?.shopName || inv.shopName || "",
            phone: inv.customer?.phone || inv.phone || "",
            dueDate: dueDate.toISOString().split("T")[0],
            dueAmount: inv.dueAmount || 0, // ✅ Map to dueAmount
            daysOverdue: daysOverdue,
            status: inv.status,
          };
        })
        .filter(
          (inv: OverdueInvoice) => inv.dueAmount > 0 && inv.status !== "Paid"
        ); // ✅ Use dueAmount in filter

      setInvoices(mappedInvoices);
    } catch (error) {
      console.error("Error fetching overdue invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [currentBusinessId]);

  useEffect(() => {
    fetchOverdueInvoices();
  }, [fetchOverdueInvoices]);

  // Filter Logic
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
    (a, b) => b.daysOverdue - a.daysOverdue
  );

  // Badge Logic
  const getAgingBadge = (days: number) => {
    if (days <= 0)
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700">
          Current
        </Badge>
      );
    if (days >= 90)
      return <Badge className="bg-red-600 animate-pulse">90+ Days</Badge>;
    if (days >= 60) return <Badge className="bg-orange-500">60+ Days</Badge>;
    if (days >= 30) return <Badge className="bg-yellow-500">30+ Days</Badge>;
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-200">
        {days} Days
      </Badge>
    );
  };

  const handlePayClick = (invoice: OverdueInvoice) => {
    setSelectedInvoice(invoice);
    setIsPayDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-red-900">
            Due Invoices
          </h1>
          <p className="text-muted-foreground mt-1">
            Review outstanding balances and record payments.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchOverdueInvoices}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Age" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="30+">30+ Days Overdue</SelectItem>
                <SelectItem value="60+">60+ Days Overdue</SelectItem>
                <SelectItem value="90+">90+ Days Overdue</SelectItem>
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
                {sortedInvoices.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No due invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="hover:bg-red-50/10"
                    >
                      <TableCell className="font-mono">
                        {invoice.invoiceNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {invoice.shopName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.customerName}
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
                        {/* ✅ Corrected to use dueAmount */}
                        <span className="font-bold text-red-600">
                          LKR {invoice.dueAmount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() =>
                              router.push(
                                `/dashboard/office/wireman/invoices/${invoice.id}`
                              )
                            }
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>

                          {/* PAY BUTTON */}
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handlePayClick(invoice)}
                          >
                            <CreditCard className="w-3 h-3 mr-1" /> Pay
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

      <RecordPaymentDialog
        isOpen={isPayDialogOpen}
        setIsOpen={setIsPayDialogOpen}
        invoice={selectedInvoice}
        onPaymentSuccess={fetchOverdueInvoices}
      />
    </div>
  );
}