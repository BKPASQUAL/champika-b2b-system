"use client";

import React, { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, RefreshCw, ShoppingCart, Calendar, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function RetailPurchasesPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const { data: rawPurchases = [], loading, refetch } = useCachedFetch<any[]>(
    `/api/purchases?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`,
    [],
    () => toast.error("Failed to load purchases")
  );

  const purchases = useMemo(() =>
    rawPurchases.map((p: any) => ({
      id: p.id,
      purchaseId: p.purchaseId,
      supplierId: p.supplierId,
      supplierName: p.supplierName || "—",
      invoiceNo: p.invoiceNo || "—",
      purchaseDate: p.purchaseDate,
      status: p.status,
      paymentStatus: p.paymentStatus,
      totalAmount: Number(p.totalAmount),
      paidAmount: Number(p.paidAmount),
    })),
    [rawPurchases]
  );

  const filtered = purchases.filter((p) => {
    const matchesSearch = searchQuery.trim() === "" ||
      p.purchaseId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPayment = paymentFilter === "all" || p.paymentStatus === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  const totalPurchased = purchases.reduce((s, p) => s + p.totalAmount, 0);
  const totalDue = purchases.reduce((s, p) => s + (p.totalAmount - p.paidAmount), 0);
  const unpaidCount = purchases.filter((p) => p.paymentStatus === "Unpaid").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-900 flex items-center gap-2">
            Purchases <ShoppingCart className="w-6 h-6 text-green-600" />
          </h1>
          <p className="text-muted-foreground mt-1">Champika Hardware — Retail supplier purchases</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() => router.push("/dashboard/office/retail/purchases/create")}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            New Purchase
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bills", value: purchases.length.toString(), color: "text-green-700" },
          { label: "Total Purchased", value: `LKR ${totalPurchased.toLocaleString()}`, color: "text-blue-700" },
          { label: "Total Due", value: `LKR ${totalDue.toLocaleString()}`, color: totalDue > 0 ? "text-red-600" : "text-green-700" },
          { label: "Unpaid Bills", value: unpaidCount.toString(), color: unpaidCount > 0 ? "text-amber-600" : "text-green-700" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search PO #, invoice or supplier…"
                className="pl-9 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Filter className="w-3 h-3" />
                  <SelectValue placeholder="Payment Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-green-50/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier Invoice</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      {loading ? "Loading…" : "No purchases found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((bill) => {
                    const due = bill.totalAmount - bill.paidAmount;
                    return (
                      <TableRow key={bill.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(bill.purchaseDate).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium font-mono">{bill.purchaseId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            {bill.invoiceNo}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{bill.supplierName}</TableCell>
                        <TableCell><Badge variant="outline">{bill.status}</Badge></TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            bill.paymentStatus === "Paid" ? "bg-green-100 text-green-700"
                              : bill.paymentStatus === "Unpaid" ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>{bill.paymentStatus}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">LKR {bill.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {due > 0 ? `LKR ${due.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/office/retail/purchases/${bill.id}`)}>
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
