"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  FileText,
  CreditCard,
  BarChart3,
  Tag,
  X,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TablePagination } from "@/components/ui/TablePagination";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityRecord {
  id: string;
  portal: string;
  business_id: string | null;
  business_name: string | null;
  action_type: string;
  record_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  amount: number | null;
  performed_by_id: string | null;
  performed_by_name: string | null;
  performed_by_email: string | null;
  classification: Record<string, string> | null;
  metadata: Record<string, any> | null;
  notes: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(n);
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
  });

// Badge colour maps
const TYPE_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "Distribution Invoice": { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  "Retail Invoice":       { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500"  },
  "Agency Invoice":       { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  "Payment Made":         { bg: "bg-emerald-50",text: "text-emerald-700",dot: "bg-emerald-500"},
  "Rep Order":            { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  "Invoice Created":      { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"   },
};

const PORTAL_STYLE: Record<string, { bg: string; text: string }> = {
  admin:  { bg: "bg-slate-100",  text: "text-slate-700"  },
  office: { bg: "bg-sky-100",    text: "text-sky-700"    },
  rep:    { bg: "bg-violet-100", text: "text-violet-700" },
  retail: { bg: "bg-teal-100",   text: "text-teal-700"   },
};

const MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS public.activity_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal              TEXT NOT NULL,
  business_id         UUID,
  business_name       TEXT,
  action_type         TEXT NOT NULL,
  record_type         TEXT NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID,
  entity_no           TEXT,
  customer_id         UUID,
  customer_name       TEXT,
  amount              NUMERIC(15, 2),
  performed_by_id     UUID,
  performed_by_name   TEXT,
  performed_by_email  TEXT,
  classification      JSONB,
  metadata            JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_records_portal
  ON public.activity_records (portal);
CREATE INDEX IF NOT EXISTS idx_activity_records_action_type
  ON public.activity_records (action_type);
CREATE INDEX IF NOT EXISTS idx_activity_records_customer_id
  ON public.activity_records (customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_records_created_at
  ON public.activity_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_records_business_id
  ON public.activity_records (business_id);
CREATE INDEX IF NOT EXISTS idx_activity_records_performed_by
  ON public.activity_records (performed_by_id);`;

const PAGE_SIZE = 25;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityRecordsPage() {
  const [records, setRecords]           = useState<ActivityRecord[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [copied, setCopied]             = useState(false);

  // Filters
  const [search, setSearch]                   = useState("");
  const [filterPortal, setFilterPortal]       = useState("all");
  const [filterActionType, setFilterActionType] = useState("all");
  const [page, setPage]                       = useState(0);

  // Detail dialog
  const [selected, setSelected] = useState<ActivityRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filterPortal !== "all")     params.set("portal",      filterPortal);
      if (filterActionType !== "all") params.set("action_type", filterActionType);

      const res  = await fetch(`/api/activity-records?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      if (data.setup_required) { setSetupRequired(true); return; }
      setSetupRequired(false);
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterPortal, filterActionType]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = records.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.customer_name?.toLowerCase().includes(q) ||
      r.entity_no?.toLowerCase().includes(q) ||
      r.performed_by_name?.toLowerCase().includes(q) ||
      r.performed_by_email?.toLowerCase().includes(q) ||
      r.record_type.toLowerCase().includes(q) ||
      r.business_name?.toLowerCase().includes(q)
    );
  });

  const totalPages   = Math.ceil(total / PAGE_SIZE);
  const hasFilters   = search || filterPortal !== "all" || filterActionType !== "all";
  const invoiceCount = records.filter((r) =>
    ["distribution_invoice","retail_invoice","rep_order","invoice_created","agency_invoice"].includes(r.action_type)
  ).length;
  const paymentCount    = records.filter((r) => r.action_type === "payment_made").length;
  const classifiedCount = records.filter((r) => r.classification && Object.keys(r.classification).length > 0).length;

  const exportCSV = () => {
    const headers = ["Date/Time","Record Type","Portal","Business","Invoice / Ref","Customer","Amount","Classification"];
    const rows = records.map((r) => [
      fmtDate(r.created_at), r.record_type, r.portal,
      r.business_name ?? "", r.entity_no ?? "", r.customer_name ?? "",
      r.amount ?? "",
      r.classification
        ? Object.entries(r.classification).map(([k,v]) => `${k}: ${v}`).join(" | ")
        : "",
    ]);
    const csv = [headers,...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(","))
      .join("\n");
    const a   = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `activity-records-${new Date().toISOString().split("T")[0]}.csv`,
    });
    a.click();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const clearFilters = () => {
    setSearch(""); setFilterPortal("all"); setFilterActionType("all"); setPage(0);
  };

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (setupRequired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-8 max-w-2xl mx-auto px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 ring-4 ring-amber-50">
          <Terminal className="h-8 w-8 text-amber-600" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Database setup required</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
              activity_records
            </code>{" "}
            table does not exist yet. Run the SQL below once in the Supabase
            SQL Editor — it only takes 30 seconds.
          </p>
        </div>

        {/* Steps */}
        <div className="w-full rounded-xl border bg-muted/30 px-5 py-4 space-y-2">
          {[
            { n: 1, text: 'Click "Copy SQL" then "Open SQL Editor"' },
            { n: 2, text: 'Paste the SQL in the editor and click Run (green button)' },
            { n: 3, text: 'Come back here and click "Reload page"' },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-start gap-3 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">
                {n}
              </span>
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>

        {/* SQL block */}
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">SQL Migration</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 h-8">
                {copied
                  ? <><Check className="h-3.5 w-3.5 text-green-600" />Copied!</>
                  : <><Copy className="h-3.5 w-3.5" />Copy SQL</>}
              </Button>
              <Button size="sm" variant="default" asChild className="gap-1.5 h-8">
                <a href="https://supabase.com/dashboard/project/khsileqvitdeudkmvqvo/sql/new"
                   target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open SQL Editor
                </a>
              </Button>
            </div>
          </div>
          <pre className="bg-zinc-950 text-zinc-100 text-xs rounded-xl p-5 overflow-x-auto leading-relaxed whitespace-pre-wrap border border-zinc-800">
            {MIGRATION_SQL}
          </pre>
        </div>

        <Button onClick={fetchRecords} size="lg" className="gap-2 w-full sm:w-auto">
          <RefreshCw className="h-4 w-4" />
          Reload page
        </Button>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Activity Records</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              All invoice & payment actions — with classification data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 flex-1 sm:flex-none">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecords}
            disabled={loading}
            className="gap-1.5 flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Total Records"
          value={total}
          color="blue"
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Invoices Created"
          value={invoiceCount}
          color="indigo"
        />
        <StatCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Payments Recorded"
          value={paymentCount}
          color="emerald"
        />
        <StatCard
          icon={<Tag className="h-4 w-4" />}
          label="Classified"
          value={classifiedCount}
          color="violet"
          note={total > 0 ? `${Math.round((classifiedCount / total) * 100)}% of records` : undefined}
        />
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="px-5 pt-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:grid-cols-4">

            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Customer, invoice, rep…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
            </div>

            {/* Portal filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Portal</Label>
              <Select
                value={filterPortal}
                onValueChange={(v) => { setFilterPortal(v); setPage(0); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Portals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Portals</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="rep">Rep</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Record type filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Record Type</Label>
              <Select
                value={filterActionType}
                onValueChange={(v) => { setFilterActionType(v); setPage(0); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="distribution_invoice">Distribution Invoice</SelectItem>
                  <SelectItem value="retail_invoice">Retail Invoice</SelectItem>
                  <SelectItem value="agency_invoice">Agency Invoice</SelectItem>
                  <SelectItem value="rep_order">Rep Order</SelectItem>
                  <SelectItem value="payment_made">Payment Made</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground invisible select-none">
                &nbsp;
              </Label>
              <Button
                variant={hasFilters ? "destructive" : "outline"}
                className="w-full gap-2"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                {hasFilters ? <X className="h-4 w-4" /> : null}
                {hasFilters ? "Clear Filters" : "No Active Filters"}
              </Button>
            </div>
          </div>

          {/* Active filter pills */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {search && (
                <FilterPill label={`Search: "${search}"`} onRemove={() => setSearch("")} />
              )}
              {filterPortal !== "all" && (
                <FilterPill
                  label={`Portal: ${filterPortal}`}
                  onRemove={() => { setFilterPortal("all"); setPage(0); }}
                />
              )}
              {filterActionType !== "all" && (
                <FilterPill
                  label={`Type: ${filterActionType.replace(/_/g, " ")}`}
                  onRemove={() => { setFilterActionType("all"); setPage(0); }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading records…"
              : `Showing ${filtered.length}${filtered.length !== total ? ` of ${total}` : ""} record${total !== 1 ? "s" : ""}`}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground">
              Page {page + 1} / {totalPages}
            </p>
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-36 pl-5">Date</TableHead>
                <TableHead className="w-40">Type</TableHead>
                <TableHead className="w-24">Portal</TableHead>
                <TableHead>Business</TableHead>
                <TableHead className="w-32">Ref / Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead className="text-right w-36">Amount</TableHead>
                <TableHead className="w-28 text-center">Classified</TableHead>
                <TableHead className="w-16 pr-5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <p className="text-sm">Loading records…</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ClipboardList className="h-8 w-8 opacity-30" />
                      <p className="text-sm font-medium">No records found</p>
                      {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-1">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const ts = TYPE_STYLE[r.record_type];
                  const ps = PORTAL_STYLE[r.portal];
                  const isClassified = r.classification && Object.keys(r.classification).length > 0;
                  return (
                    <TableRow
                      key={r.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelected(r)}
                    >
                      <TableCell className="pl-5">
                        <div className="text-sm font-medium">{fmtDateShort(r.created_at)}</div>
                        <div className="text-xs text-muted-foreground">{fmtTime(r.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ts?.bg ?? "bg-gray-100"} ${ts?.text ?? "text-gray-700"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${ts?.dot ?? "bg-gray-400"}`} />
                          {r.record_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${ps?.bg ?? "bg-gray-100"} ${ps?.text ?? "bg-gray-700"}`}>
                          {r.portal}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                        {r.business_name ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold">
                        {r.entity_no ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-40 truncate">
                        {r.customer_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-40">
                        {r.performed_by_name ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium truncate">{r.performed_by_name}</span>
                            {r.performed_by_email && (
                              <span className="text-xs text-muted-foreground truncate">{r.performed_by_email}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold tabular-nums">{fmt(r.amount)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {isClassified ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs gap-1">
                            <Check className="h-3 w-3" />Done
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="md:hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading records…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <ClipboardList className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">No records found</p>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-1">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const ts = TYPE_STYLE[r.record_type];
                const ps = PORTAL_STYLE[r.portal];
                const isClassified = r.classification && Object.keys(r.classification).length > 0;
                return (
                  <div
                    key={r.id}
                    className="px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors active:bg-muted/50"
                    onClick={() => setSelected(r)}
                  >
                    {/* Row 1: type badge + portal + classified */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ts?.bg ?? "bg-gray-100"} ${ts?.text ?? "text-gray-700"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ts?.dot ?? "bg-gray-400"}`} />
                        {r.record_type}
                      </span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${ps?.bg ?? "bg-gray-100"} ${ps?.text ?? "text-gray-700"}`}>
                        {r.portal}
                      </span>
                      <div className="ml-auto">
                        {isClassified ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs gap-1">
                            <Check className="h-3 w-3" />Done
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                        )}
                      </div>
                    </div>

                    {/* Row 2: customer + amount */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.customer_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.business_name ?? ""}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums shrink-0">{fmt(r.amount)}</span>
                    </div>

                    {/* Row 3: ref + date + performed by */}
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-foreground">{r.entity_no ?? "—"}</span>
                        {r.performed_by_name && (
                          <span className="truncate">· {r.performed_by_name}</span>
                        )}
                      </div>
                      <span className="shrink-0">{fmtDateShort(r.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <TablePagination
          currentPage={page + 1}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p - 1)}
          totalItems={total}
          itemsPerPage={PAGE_SIZE}
        />
      </Card>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="w-[95vw] sm:max-w-[580px] max-h-[90vh] overflow-y-auto p-0 gap-0">
            {/* Dialog header */}
            <div className="sticky top-0 z-10 bg-background border-b px-4 sm:px-6 py-3 sm:py-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const ts = TYPE_STYLE[selected.record_type];
                    return (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ts?.bg ?? "bg-gray-100"} ${ts?.text ?? "text-gray-700"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ts?.dot ?? "bg-gray-400"}`} />
                        {selected.record_type}
                      </span>
                    );
                  })()}
                  <span className="font-mono text-sm text-muted-foreground">
                    {selected.entity_no ?? selected.id.slice(0, 8).toUpperCase()}
                  </span>
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
              {/* Record details */}
              <DetailSection title="Record Details">
                <DetailRow label="Date & Time"   value={fmtDate(selected.created_at)} />
                <DetailRow label="Portal"        value={<span className="capitalize font-medium">{selected.portal}</span>} />
                <DetailRow label="Business"      value={selected.business_name ?? "—"} />
                <DetailRow label="Customer"      value={<span className="font-medium">{selected.customer_name ?? "—"}</span>} />
                <DetailRow label="Amount"        value={<span className="font-semibold text-primary">{fmt(selected.amount)}</span>} />
                <DetailRow label="Invoice / Ref" value={<span className="font-mono">{selected.entity_no ?? "—"}</span>} />
                <DetailRow label="Performed By"  value={
                  selected.performed_by_name ? (
                    <div className="flex flex-col gap-0.5 text-right">
                      <span className="font-medium">{selected.performed_by_name}</span>
                      {selected.performed_by_email && (
                        <span className="text-xs text-muted-foreground">{selected.performed_by_email}</span>
                      )}
                    </div>
                  ) : "System"
                } />
              </DetailSection>

              {/* Classification */}
              <DetailSection
                title="Classification Answers"
                badge={
                  selected.classification && Object.keys(selected.classification).length > 0
                    ? <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Completed</span>
                    : <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Not answered</span>
                }
              >
                {selected.classification && Object.keys(selected.classification).length > 0
                  ? Object.entries(selected.classification).map(([key, value]) => (
                      <DetailRow
                        key={key}
                        label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        value={String(value)}
                      />
                    ))
                  : (
                    <p className="px-4 py-3 text-sm text-muted-foreground italic">
                      No classification answers for this entry.
                    </p>
                  )
                }
              </DetailSection>

              {/* Metadata */}
              {selected.metadata && (
                <DetailSection title="Metadata Snapshot">
                  <div className="px-4 py-3">
                    <pre className="bg-zinc-950 text-zinc-100 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </div>
                </DetailSection>
              )}

              {/* Notes */}
              {selected.notes && (
                <DetailSection title="Notes">
                  <p className="px-4 py-3 text-sm">{selected.notes}</p>
                </DetailSection>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, color, note,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "indigo" | "emerald" | "violet";
  note?: string;
}) {
  const colors = {
    blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    ring: "ring-blue-100"    },
    indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  ring: "ring-indigo-100"  },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-100" },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  ring: "ring-violet-100"  },
  }[color];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2 truncate">
              {label}
            </p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums truncate">{value}</p>
            {note && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{note}</p>}
          </div>
          <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg ${colors.bg} ${colors.icon} ring-2 sm:ring-4 ${colors.ring}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="ml-1 hover:text-primary/60 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function DetailSection({
  title, badge, children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {badge}
      </div>
      <div className="rounded-xl border divide-y overflow-hidden">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between px-4 py-3 sm:py-2.5 gap-1 sm:gap-6">
      <span className="text-xs text-muted-foreground sm:min-w-[130px] pt-0.5">{label}</span>
      <span className="text-sm font-medium sm:font-normal sm:text-right break-words">{value}</span>
    </div>
  );
}
