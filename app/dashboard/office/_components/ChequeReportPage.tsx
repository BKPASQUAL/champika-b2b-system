"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Search,
  RefreshCw,
  Printer,
  ArrowUpDown,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ChequeStatus = "Pending" | "Deposited" | "Cleared" | "Bounced" | "Returned";
type ThemeColor = "purple" | "red" | "blue" | "orange" | "gray";

interface ChequeRow {
  id: string;
  chequeDate: string | null;
  chequeNo: string | null;
  branchCode: string | null;
  bankCode: string | null;
  bankName: string | null;
  customerName: string;
  invoiceNo: string;
  amount: number;
  status: ChequeStatus;
}

export interface ChequeReportPageProps {
  defaultBusinessId?: string;
  portalName: string;
  themeColor: ThemeColor;
  Icon: React.ComponentType<{ className?: string }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
  }).format(n);

const formatDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// Branch code is stored embedded in cheque_no as "123456 (Branch: 789)"
function parseChequeNo(raw: string | null): { no: string | null; branch: string | null } {
  if (!raw) return { no: null, branch: null };
  const match = raw.match(/^(.+?)\s*\(Branch:\s*(.+?)\)$/);
  if (match) return { no: match[1].trim(), branch: match[2].trim() };
  return { no: raw, branch: null };
}

const THEME: Record<ThemeColor, { header: string; iconWrap: string }> = {
  purple: { header: "text-purple-900", iconWrap: "bg-purple-100 text-purple-600" },
  red:    { header: "text-red-900",    iconWrap: "bg-red-100 text-red-600" },
  blue:   { header: "text-blue-900",   iconWrap: "bg-blue-100 text-blue-600" },
  orange: { header: "text-orange-900", iconWrap: "bg-orange-100 text-orange-600" },
  gray:   { header: "text-gray-900",   iconWrap: "bg-gray-100 text-gray-600" },
};

// ─── Print content (injected into same window) ────────────────────────────────

function buildPrintContent(rows: ChequeRow[]) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const rowsHtml = rows
    .map(
      (r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${formatDate(r.chequeDate)}</td>
      <td>${r.chequeNo || "—"}</td>
      <td>${r.bankCode || "—"}</td>
      <td>${r.bankName || "—"}</td>
      <td>${r.branchCode || "—"}</td>
      <td style="text-align:right">${formatCurrency(r.amount)}</td>
    </tr>`,
    )
    .join("");

  // Scoped styles using the data attribute selector so they don't leak into the page
  return `
    <style>
      [data-cheque-print] * { box-sizing: border-box; margin: 0; padding: 0; }
      [data-cheque-print] { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
      [data-cheque-print] table { width: 100%; border-collapse: collapse; margin-top: 4px; }
      [data-cheque-print] th { background: #e8e8e8; font-weight: bold; padding: 5px 6px; border: 1px solid #bbb; text-align: left; font-size: 10px; }
      [data-cheque-print] td { padding: 4px 6px; border: 1px solid #ddd; font-size: 10px; vertical-align: middle; }
      [data-cheque-print] tr:nth-child(even) td { background: #f9f9f9; }
      [data-cheque-print] .total-row td { font-weight: bold; background: #e8e8e8; border-top: 2px solid #888; }
    </style>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Cheque Date</th>
          <th>Cheque No</th>
          <th>Bank Code</th>
          <th>Bank Name</th>
          <th>Branch Code</th>
          <th style="text-align:right">Amount (LKR)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="6">Total — ${rows.length} cheque(s)</td>
          <td style="text-align:right">${formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>`;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ChequeReportPage({
  defaultBusinessId,
  portalName,
  themeColor,
  Icon,
}: ChequeReportPageProps) {
  const t = THEME[themeColor];
  const todayStr = new Date().toISOString().split("T")[0];

  const [businessId, setBusinessId] = useState<string | null>(defaultBusinessId ?? null);
  useEffect(() => {
    if (!defaultBusinessId) return;
    const user = getUserBusinessContext();
    setBusinessId(user?.businessId ?? defaultBusinessId);
  }, [defaultBusinessId]);

  const paymentsUrl = businessId
    ? `/api/payments?businessId=${businessId}`
    : `/api/payments`;

  const { data: rawPayments = [], loading, refetch } = useCachedFetch<any[]>(
    paymentsUrl,
    [],
    () => toast.error("Failed to load payments"),
  );

  // ─── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ChequeStatus>("All");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ─── Selection state ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when filters change so stale selections don't persist
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, dateFrom, dateTo, statusFilter, sortDir]);

  // ─── Build rows ────────────────────────────────────────────────────────────
  const allRows = useMemo<ChequeRow[]>(() => {
    return rawPayments
      .filter((p: any) => p.payment_method?.toLowerCase() === "cheque")
      .map((p: any): ChequeRow => {
        const { no, branch } = parseChequeNo(p.cheque_number);
        return {
          id: p.id,
          chequeDate: p.cheque_date ?? null,
          chequeNo: no,
          branchCode: branch,
          bankCode: p.banks?.bank_code ?? null,
          bankName: p.banks?.bank_name ?? null,
          customerName: p.customers?.name || "Unknown",
          invoiceNo: p.invoices?.invoice_no || "N/A",
          amount: Number(p.amount),
          status: (p.cheque_status as ChequeStatus) || "Pending",
        };
      });
  }, [rawPayments]);

  // ─── Filter + sort ─────────────────────────────────────────────────────────
  const filteredRows = useMemo<ChequeRow[]>(() => {
    return allRows
      .filter((r) => {
        if (dateFrom && r.chequeDate && r.chequeDate < dateFrom) return false;
        if (dateTo && r.chequeDate && r.chequeDate > dateTo) return false;
        if (statusFilter !== "All" && r.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !r.customerName.toLowerCase().includes(q) &&
            !r.chequeNo?.toLowerCase().includes(q) &&
            !r.bankCode?.toLowerCase().includes(q) &&
            !r.bankName?.toLowerCase().includes(q) &&
            !r.invoiceNo?.toLowerCase().includes(q) &&
            !r.branchCode?.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.chequeDate
          ? new Date(a.chequeDate).getTime()
          : sortDir === "asc" ? Infinity : -Infinity;
        const db = b.chequeDate
          ? new Date(b.chequeDate).getTime()
          : sortDir === "asc" ? Infinity : -Infinity;
        return sortDir === "asc" ? da - db : db - da;
      });
  }, [allRows, dateFrom, dateTo, statusFilter, search, sortDir]);

  // ─── Selection helpers ─────────────────────────────────────────────────────
  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));
  const someSelected = !allSelected && filteredRows.some((r) => selectedIds.has(r.id));
  const selectedCount = filteredRows.filter((r) => selectedIds.has(r.id)).length;
  const selectedTotal = filteredRows
    .filter((r) => selectedIds.has(r.id))
    .reduce((s, r) => s + r.amount, 0);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalAmount = filteredRows.reduce((s, r) => s + r.amount, 0);
  const isDirty =
    search !== "" || dateFrom !== todayStr || dateTo !== "" || statusFilter !== "All";

  // ─── Same-window print ─────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const rowsToPrint = filteredRows.filter((r) => selectedIds.has(r.id));
    if (rowsToPrint.length === 0) return;

    const content = buildPrintContent(rowsToPrint);

    // Inject print styles: hide everything on the page, show only our print div
    const printStyle = document.createElement("style");
    printStyle.textContent = `@media print { body > *:not([data-cheque-print]) { display: none !important; } [data-cheque-print] { display: block !important; } }`;
    document.head.appendChild(printStyle);

    // Inject print content as a direct body child
    const printDiv = document.createElement("div");
    printDiv.setAttribute("data-cheque-print", "");
    printDiv.innerHTML = content;
    document.body.appendChild(printDiv);

    window.print();

    // Clean up after print dialog closes
    const cleanup = () => {
      printStyle.remove();
      printDiv.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
  }, [filteredRows, selectedIds, portalName, dateFrom, dateTo, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", t.iconWrap)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className={cn("text-3xl font-bold tracking-tight", t.header)}>Cheque Report</h1>
            <p className="text-muted-foreground text-sm">{portalName} — Customer cheques</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            disabled={selectedCount === 0 || loading}
            className="gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Generate Report
            {selectedCount > 0 && (
              <span className="ml-0.5 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold">
                {selectedCount}
              </span>
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customer, cheque no, bank…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground shrink-0">Cheque date:</span>
          <Input
            type="date"
            className="w-[148px]"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-muted-foreground text-sm shrink-0">to</span>
          <Input
            type="date"
            className="w-[148px]"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "All" | ChequeStatus)}
          >
            <SelectTrigger className="w-[135px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Deposited">Deposited</SelectItem>
              <SelectItem value="Cleared">Cleared</SelectItem>
              <SelectItem value="Bounced">Bounced</SelectItem>
              <SelectItem value="Returned">Returned</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortDir === "asc" ? "Earliest first" : "Latest first"}
          </Button>
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setDateFrom(todayStr);
                setDateTo("");
                setStatusFilter("All");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {!loading && (
        <div className="flex items-center gap-4 flex-wrap rounded-lg border bg-muted/30 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredRows.length}</span> cheques
          </span>
          <span className="text-muted-foreground">
            Total: <span className="font-bold text-foreground">{formatCurrency(totalAmount)}</span>
          </span>
          {selectedCount > 0 && (
            <>
              <span className="h-3 w-px bg-border" />
              <span className="text-blue-600 font-medium">
                {selectedCount} selected · {formatCurrency(selectedTotal)}
              </span>
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            </>
          )}
          {selectedCount === 0 && (
            <span className="text-xs text-amber-600 font-medium">
              ← Select cheques to generate report
            </span>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <FileText className="h-10 w-10 opacity-20" />
          <p className="text-sm">No cheques found for the selected filters</p>
          {isDirty && (
            <button
              className="text-xs text-blue-600 hover:underline mt-1"
              onClick={() => {
                setSearch("");
                setDateFrom(todayStr);
                setDateTo("");
                setStatusFilter("All");
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-8 text-center">#</TableHead>
                <TableHead>Cheque Date</TableHead>
                <TableHead>Cheque No</TableHead>
                <TableHead>Bank Code</TableHead>
                <TableHead>Bank Name</TableHead>
                <TableHead>Branch Code</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, idx) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer",
                      isSelected ? "bg-blue-50/60 hover:bg-blue-50/80" : "hover:bg-muted/20",
                    )}
                    onClick={() => toggleRow(row.id)}
                  >
                    <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(row.id)}
                        aria-label={`Select cheque ${row.chequeNo}`}
                      />
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatDate(row.chequeDate)}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">
                      {row.chequeNo || "—"}
                    </TableCell>
                    <TableCell>
                      {row.bankCode ? (
                        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                          {row.bankCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.bankName || "—"}
                    </TableCell>
                    <TableCell>
                      {row.branchCode ? (
                        <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-blue-700 border border-blue-200">
                          {row.branchCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-sm">
                      {formatCurrency(row.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Footer */}
          <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2">
            <span className="text-xs text-muted-foreground font-medium">
              {selectedCount > 0
                ? `${selectedCount} of ${filteredRows.length} selected`
                : `${filteredRows.length} cheque(s)`}
            </span>
            <span className="text-sm font-bold tabular-nums">
              {selectedCount > 0 ? formatCurrency(selectedTotal) : formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
