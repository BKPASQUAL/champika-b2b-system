"use client";

import { useState } from "react";
import Link from "next/link";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { toast } from "sonner";
import { Plus, Printer, Eye, Trash2, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { printQuotation } from "@/app/lib/quotation-print";

interface QuotationRow {
  id: string;
  quotation_no: string;
  date: string;
  valid_until?: string;
  customer_name: string;
  customer_phone?: string;
  status: string;
  grand_total: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-orange-100 text-orange-700",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2 }).format(n || 0);

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("en-GB") : "-";

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: quotations = [], loading, refetch } = useCachedFetch<QuotationRow[]>(
    `/api/quotations?status=${statusFilter}&search=${search}`,
    []
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this quotation?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Quotation deleted");
      refetch();
    } catch {
      toast.error("Failed to delete quotation");
    } finally {
      setDeleting(null);
    }
  };

  const handlePrint = async (id: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const q = await res.json();
      printQuotation(q);
    } catch {
      toast.error("Failed to load quotation for printing");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Status updated to ${status}`);
      refetch();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" /> Quotations
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage price quotations for customers.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/office/distribution/quotations/create">
            <Plus className="w-4 h-4 mr-2" /> New Quotation
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Accepted">Accepted</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
          ) : quotations.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No quotations found</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first quotation to get started.</p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/office/distribution/quotations/create">
                  <Plus className="w-4 h-4 mr-2" /> New Quotation
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-semibold text-blue-700">
                      {q.quotation_no}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{q.customer_name || "—"}</div>
                      {q.customer_phone && (
                        <div className="text-xs text-muted-foreground">{q.customer_phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(q.date)}</TableCell>
                    <TableCell className="text-sm">
                      {q.valid_until ? (
                        <span className={new Date(q.valid_until) < new Date() ? "text-red-600" : ""}>
                          {fmtDate(q.valid_until)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Select value={q.status} onValueChange={(v) => handleStatusChange(q.id, v)}>
                        <SelectTrigger className="h-7 w-28 text-xs border-0 p-0 shadow-none focus:ring-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] ?? "bg-gray-100"}`}>
                            {q.status}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(STATUS_COLORS).map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      Rs. {fmt(q.grand_total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/dashboard/office/distribution/quotations/${q.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handlePrint(q.id)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm"
                          disabled={deleting === q.id}
                          onClick={() => handleDelete(q.id)}
                          className="hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
