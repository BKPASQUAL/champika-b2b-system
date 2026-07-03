"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useCachedFetch } from "@/hooks/useCachedFetch";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { TablePagination } from "@/components/ui/TablePagination";

const ITEMS_PER_PAGE = 15;

export default function QuotationsListPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: quotations = [],
    loading,
    refetch,
  } = useCachedFetch<any[]>(
    `/api/quotations?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`,
    [],
    () => toast.error("Failed to load quotations")
  );

  const filtered = (quotations || []).filter((q: any) => {
    const q_ = searchQuery.toLowerCase();
    return (
      q.quotationNo?.toLowerCase().includes(q_) ||
      q.customerName?.toLowerCase().includes(q_)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const statusBadge = (status: string) => {
    if (status === "Converted")
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
          <CheckCircle2 className="w-3 h-3" /> Converted
        </Badge>
      );
    if (status === "Expired")
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <XCircle className="w-3 h-3" /> Expired
        </Badge>
      );
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
        <Clock className="w-3 h-3" /> Active
      </Badge>
    );
  };

  const activeCount = (quotations || []).filter((q: any) => q.status === "Active").length;
  const convertedCount = (quotations || []).filter((q: any) => q.status === "Converted").length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-green-950">Quotations</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage retail quotations — convert to invoice when ready.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => router.push("/dashboard/office/retail/quotations/create")}
          >
            <Plus className="w-4 h-4 mr-2" /> New Quotation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{(quotations || []).length}</div>
            <p className="text-xs text-muted-foreground">All quotations</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Pending conversion</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{convertedCount}</div>
            <p className="text-xs text-muted-foreground">Turned into bills</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Value (Active)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              LKR {(
                (quotations || [])
                  .filter((q: any) => q.status === "Active")
                  .reduce((s: number, q: any) => s + (q.grandTotal || 0), 0) / 1000
              ).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground">Pending value</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" /> All Quotations
              </CardTitle>
              <CardDescription>{filtered.length} quotation(s)</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by number or customer..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-green-50/50">
                  <TableHead>Quotation No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {searchQuery ? "No quotations match your search" : "No quotations yet — create one!"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((q: any) => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/office/retail/quotations/${q.id}`)}
                    >
                      <TableCell className="font-mono font-semibold text-green-700">
                        {q.quotationNo}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{q.customerName}</div>
                        {q.customerOwner && (
                          <div className="text-xs text-muted-foreground">{q.customerOwner}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{q.date}</TableCell>
                      <TableCell className="text-center text-sm">{q.itemCount}</TableCell>
                      <TableCell className="text-right font-semibold">
                        LKR {(q.grandTotal || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(q.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
