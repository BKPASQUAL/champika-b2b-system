"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CreditCard, Calendar, TrendingUp, ShoppingBag,
  AlertCircle, Filter, XCircle, RefreshCw, Zap,
  Clock, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type CollectionStatus = "immediate" | "on_time" | "late_paid" | "pending" | "overdue_cut";

type CardFilter =
  | "all"
  | "collected"
  | "pending_collection"
  | "overdue"
  | "commission_earned"
  | "immediate"
  | "commission_pending"
  | "commission_cut";

interface CommissionRecord {
  id: string;
  orderRef: string;
  invoiceNo: string | null;
  shopName: string;
  invoiceDate: string;
  paymentDate: string | null;
  daysToPayment: number | null;
  daysSinceInvoice: number;
  orderTotal: number;
  paidAmount: number;
  dueAmount: number;
  commissionAmount: number;
  commissionEarned: number;
  commissionCut: number;
  commissionPending: number;
  collectionStatus: CollectionStatus;
  payoutStatus: "Pending" | "Paid";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (n: number) =>
  `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });

const STATUS_CONFIG: Record<CollectionStatus, { label: string; bg: string; text: string }> = {
  immediate:   { label: "Immediate",     bg: "bg-emerald-100", text: "text-emerald-800" },
  on_time:     { label: "On Time",       bg: "bg-blue-100",    text: "text-blue-800"    },
  late_paid:   { label: "Late — Cut",    bg: "bg-red-100",     text: "text-red-800"     },
  pending:     { label: "Pending",       bg: "bg-orange-100",  text: "text-orange-800"  },
  overdue_cut: { label: "Overdue — Cut", bg: "bg-red-100",     text: "text-red-800"     },
};

const FILTER_LABELS: Record<CardFilter, string> = {
  all:                "All Records",
  collected:          "Collected (Fully Paid)",
  pending_collection: "Pending Collection",
  overdue:            "Overdue > 60 Days",
  commission_earned:  "Commission Earned",
  immediate:          "Immediate Collections",
  commission_pending: "Commission Pending",
  commission_cut:     "Commission Cut",
};

function applyCardFilter(records: CommissionRecord[], filter: CardFilter): CommissionRecord[] {
  switch (filter) {
    case "all":                return records;
    case "collected":          return records.filter((r) => r.paidAmount > 0 && r.dueAmount === 0);
    case "pending_collection": return records.filter((r) => r.collectionStatus === "pending");
    case "overdue":            return records.filter((r) => r.collectionStatus === "overdue_cut");
    case "commission_earned":  return records.filter((r) => r.collectionStatus === "immediate" || r.collectionStatus === "on_time");
    case "immediate":          return records.filter((r) => r.collectionStatus === "immediate");
    case "commission_pending": return records.filter((r) => r.collectionStatus === "pending");
    case "commission_cut":     return records.filter((r) => r.collectionStatus === "late_paid" || r.collectionStatus === "overdue_cut");
    default:                   return records;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommissionTrackerPage() {
  const [loading, setLoading]             = useState(true);
  const [allRecords, setAllRecords]       = useState<CommissionRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("current");
  const [activeFilter, setActiveFilter]   = useState<CardFilter>("all");
  const [repId, setRepId]                 = useState("");

  // Date options
  const dateOptions = useMemo(() => {
    const today       = new Date();
    const lastMonth   = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const twoMonths   = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const threeMonths = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    return [
      { label: `This Month — ${today.toLocaleString("default", { month: "long", year: "numeric" })}`, value: "current" },
      { label: lastMonth.toLocaleString("default", { month: "long", year: "numeric" }), value: "last" },
      { label: twoMonths.toLocaleString("default", { month: "long", year: "numeric" }), value: "2-months-ago" },
      { label: threeMonths.toLocaleString("default", { month: "long", year: "numeric" }), value: "3-months-ago" },
      { label: "All Time", value: "all" },
    ];
  }, []);

  const periodLabel = useMemo(() => {
    const today = new Date();
    const getRange = (d: Date) => {
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return `${d.toLocaleDateString("en-LK", { month: "long", year: "numeric" })} — 1st to ${end.getDate()}th`;
    };
    if (selectedMonth === "all")           return "All Time";
    if (selectedMonth === "current")       return getRange(today);
    if (selectedMonth === "last")          return getRange(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    if (selectedMonth === "2-months-ago")  return getRange(new Date(today.getFullYear(), today.getMonth() - 2, 1));
    if (selectedMonth === "3-months-ago")  return getRange(new Date(today.getFullYear(), today.getMonth() - 3, 1));
    return "";
  }, [selectedMonth]);

  const fetchData = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rep/commission?repId=${id}`);
      if (!res.ok) throw new Error("Failed");
      setAllRecords(await res.json());
    } catch {
      toast.error("Error loading commission data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      const id = JSON.parse(stored).id;
      setRepId(id);
      fetchData(id);
    } else {
      setLoading(false);
    }
  }, []);

  // Reset card filter when month changes
  const handleMonthChange = (v: string) => {
    setSelectedMonth(v);
    setActiveFilter("all");
  };

  // Filter by month
  const filteredRecords = useMemo(() => {
    if (selectedMonth === "all") return allRecords;
    const today = new Date();
    let offset = 0;
    if (selectedMonth === "last")          offset = 1;
    else if (selectedMonth === "2-months-ago") offset = 2;
    else if (selectedMonth === "3-months-ago") offset = 3;
    const target = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    return allRecords.filter((r) => {
      const d = new Date(r.invoiceDate);
      return d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
    });
  }, [selectedMonth, allRecords]);

  // Apply card filter on top of month filter → drives the table
  const tableRecords = useMemo(
    () => applyCardFilter(filteredRecords, activeFilter),
    [filteredRecords, activeFilter]
  );

  const handleCardClick = (filter: CardFilter) => {
    setActiveFilter((prev) => (prev === filter ? "all" : filter));
  };

  // Stats (always from month-filtered, not card-filtered)
  const stats = useMemo(() => {
    const totalSales        = filteredRecords.reduce((s, r) => s + r.orderTotal, 0);
    const totalCollected    = filteredRecords.reduce((s, r) => s + r.paidAmount, 0);
    const totalPending      = filteredRecords.reduce((s, r) => s + (r.collectionStatus === "pending" ? r.dueAmount : 0), 0);
    const totalOverdue      = filteredRecords.reduce((s, r) => s + (r.collectionStatus === "overdue_cut" ? r.dueAmount : 0), 0);
    const commissionEarned  = filteredRecords.reduce((s, r) => s + r.commissionEarned, 0);
    const commissionPending = filteredRecords.reduce((s, r) => s + r.commissionPending, 0);
    const commissionCut     = filteredRecords.reduce((s, r) => s + r.commissionCut, 0);
    const immediateAmount   = filteredRecords
      .filter((r) => r.collectionStatus === "immediate")
      .reduce((s, r) => s + r.commissionEarned, 0);

    const collectedCount  = filteredRecords.filter((r) => r.paidAmount > 0 && r.dueAmount === 0).length;
    const pendingCount    = filteredRecords.filter((r) => r.collectionStatus === "pending").length;
    const overdueCount    = filteredRecords.filter((r) => r.collectionStatus === "overdue_cut").length;
    const immediateCount  = filteredRecords.filter((r) => r.collectionStatus === "immediate").length;
    const cutCount        = filteredRecords.filter((r) => r.collectionStatus === "late_paid" || r.collectionStatus === "overdue_cut").length;

    return {
      totalSales, totalCollected, totalPending, totalOverdue,
      commissionEarned, commissionPending, commissionCut, immediateAmount,
      collectedCount, pendingCount, overdueCount, immediateCount, cutCount,
      orderCount: filteredRecords.length,
    };
  }, [filteredRecords]);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Commission Tracker</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Paid within 60 days = commission earned · Paid after 60 days or unpaid &gt;60 days = commission cut
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="icon" className="h-9 w-9"
            onClick={() => { if (repId) { setActiveFilter("all"); fetchData(repId); } }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-60">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Section: Sales & Collections ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
          Sales &amp; Collections
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <StatCard
            label="Total Sales"
            value={loading ? null : fmtShort(stats.totalSales)}
            sub={`${stats.orderCount} delivered orders`}
            icon={<ShoppingBag className="h-4 w-4" />}
            iconColor="text-blue-600" iconBg="bg-blue-50"
            valueColor="text-blue-700"
            activeRing="ring-blue-400"
            loading={loading}
            isActive={activeFilter === "all"}
            onClick={() => handleCardClick("all")}
          />

          <StatCard
            label="Collected"
            value={loading ? null : fmtShort(stats.totalCollected)}
            sub={`${stats.collectedCount} fully paid`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            iconColor="text-green-600" iconBg="bg-green-50"
            valueColor="text-green-700"
            activeRing="ring-green-400"
            loading={loading}
            isActive={activeFilter === "collected"}
            onClick={() => handleCardClick("collected")}
          />

          <StatCard
            label="Pending Collection"
            value={loading ? null : fmtShort(stats.totalPending)}
            sub={`${stats.pendingCount} within 60 days`}
            icon={<Clock className="h-4 w-4" />}
            iconColor="text-orange-600" iconBg="bg-orange-50"
            valueColor="text-orange-700"
            activeRing="ring-orange-400"
            loading={loading}
            isActive={activeFilter === "pending_collection"}
            onClick={() => handleCardClick("pending_collection")}
          />

          <StatCard
            label="Overdue >60 Days"
            value={loading ? null : fmtShort(stats.totalOverdue)}
            sub={`${stats.overdueCount} orders at risk`}
            icon={<AlertCircle className="h-4 w-4" />}
            iconColor="text-red-600" iconBg="bg-red-50"
            valueColor="text-red-700"
            activeRing="ring-red-400"
            loading={loading}
            highlight={stats.overdueCount > 0}
            isActive={activeFilter === "overdue"}
            onClick={() => handleCardClick("overdue")}
          />

        </div>
      </div>

      {/* ── Section: Commission Breakdown ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
          Commission Breakdown
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <StatCard
            label="Commission Earned"
            value={loading ? null : fmtShort(stats.commissionEarned)}
            sub="Paid within 60 days"
            icon={<TrendingUp className="h-4 w-4" />}
            iconColor="text-emerald-600" iconBg="bg-emerald-50"
            valueColor="text-emerald-700"
            activeRing="ring-emerald-400"
            loading={loading}
            isActive={activeFilter === "commission_earned"}
            onClick={() => handleCardClick("commission_earned")}
          />

          <StatCard
            label="Immediate Collect"
            value={loading ? null : fmtShort(stats.immediateAmount)}
            sub={`${stats.immediateCount} same-day payments`}
            icon={<Zap className="h-4 w-4" />}
            iconColor="text-sky-600" iconBg="bg-sky-50"
            valueColor="text-sky-700"
            activeRing="ring-sky-400"
            loading={loading}
            isActive={activeFilter === "immediate"}
            onClick={() => handleCardClick("immediate")}
          />

          <StatCard
            label="Commission Pending"
            value={loading ? null : fmtShort(stats.commissionPending)}
            sub="Awaiting payment"
            icon={<CreditCard className="h-4 w-4" />}
            iconColor="text-orange-600" iconBg="bg-orange-50"
            valueColor="text-orange-700"
            activeRing="ring-orange-400"
            loading={loading}
            isActive={activeFilter === "commission_pending"}
            onClick={() => handleCardClick("commission_pending")}
          />

          <StatCard
            label="Commission Cut"
            value={loading ? null : fmtShort(stats.commissionCut)}
            sub={`${stats.cutCount} orders over 60 days`}
            icon={<XCircle className="h-4 w-4" />}
            iconColor="text-red-600" iconBg="bg-red-50"
            valueColor="text-red-700"
            activeRing="ring-red-400"
            loading={loading}
            highlight={stats.commissionCut > 0}
            isActive={activeFilter === "commission_cut"}
            onClick={() => handleCardClick("commission_cut")}
          />

        </div>
      </div>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-5 pt-5">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {FILTER_LABELS[activeFilter]}
              {activeFilter !== "all" && (
                <button
                  onClick={() => setActiveFilter("all")}
                  className="ml-1 text-[10px] font-normal text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Clear filter
                </button>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{tableRecords.length} records</p>
          </div>
          {activeFilter !== "all" && (
            <Badge variant="secondary" className="bg-black text-white text-[10px]">
              Filtered
            </Badge>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="pl-6">Invoice</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-right">Order Value</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted/40 rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : tableRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRecords.map((r) => {
                    const sc    = STATUS_CONFIG[r.collectionStatus];
                    const isCut = r.collectionStatus === "late_paid" || r.collectionStatus === "overdue_cut";
                    const days  = r.daysToPayment ?? r.daysSinceInvoice;
                    const daysColor = days > 60
                      ? "text-red-600 font-bold"
                      : days <= 1
                      ? "text-emerald-600 font-bold"
                      : "text-blue-600 font-semibold";
                    return (
                      <TableRow key={r.id} className={isCut ? "bg-red-50/40" : ""}>
                        <TableCell className="pl-6 font-mono text-xs font-semibold">
                          {r.invoiceNo || r.orderRef}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{r.shopName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {fmtDate(r.invoiceDate)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.paymentDate
                            ? <span className="text-green-700 font-medium">{fmtDate(r.paymentDate)}</span>
                            : <span className="text-muted-foreground italic text-xs">Not paid</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm tabular-nums ${daysColor}`}>{days}d</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm font-semibold tabular-nums">{fmt(r.orderTotal)}</div>
                          {r.dueAmount > 0 && (
                            <div className="text-[10px] text-red-500 font-medium tabular-nums">
                              Due: {fmt(r.dueAmount)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isCut ? (
                            <div>
                              <span className="text-sm line-through text-muted-foreground tabular-nums">{fmt(r.commissionAmount)}</span>
                              <div className="text-[10px] text-red-600 font-bold tracking-wide">CUT</div>
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-green-700 tabular-nums">{fmt(r.commissionAmount)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge
                            variant="secondary"
                            className={`${sc.bg} ${sc.text} border-0 hover:${sc.bg}`}
                          >
                            {sc.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="h-4 w-2/3 bg-muted/40 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-muted/40 rounded animate-pulse" />
                </div>
              ))
            ) : tableRecords.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No records found.
              </div>
            ) : (
              tableRecords.map((r) => {
                const sc    = STATUS_CONFIG[r.collectionStatus];
                const isCut = r.collectionStatus === "late_paid" || r.collectionStatus === "overdue_cut";
                const days  = r.daysToPayment ?? r.daysSinceInvoice;
                return (
                  <div key={r.id} className={`p-4 space-y-3 ${isCut ? "bg-red-50/40" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{r.shopName}</p>
                        <p className="text-xs font-mono text-muted-foreground">{r.invoiceNo || r.orderRef}</p>
                      </div>
                      <Badge variant="secondary" className={`${sc.bg} ${sc.text} border-0 shrink-0`}>
                        {sc.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <p className="text-muted-foreground">Invoice Date</p>
                        <p className="font-medium">{fmtDate(r.invoiceDate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payment Date</p>
                        <p className={r.paymentDate ? "font-medium text-green-700" : "text-muted-foreground italic"}>
                          {r.paymentDate ? fmtDate(r.paymentDate) : "Not paid"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Days</p>
                        <p className={`font-bold tabular-nums ${days > 60 ? "text-red-600" : days <= 1 ? "text-emerald-600" : "text-blue-600"}`}>
                          {days}d
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Order Value</p>
                        <p className="font-semibold tabular-nums">{fmt(r.orderTotal)}</p>
                        {r.dueAmount > 0 && <p className="text-[10px] text-red-500">Due: {fmt(r.dueAmount)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <p className="text-xs text-muted-foreground">Commission</p>
                      {isCut ? (
                        <div className="text-right">
                          <span className="text-sm line-through text-muted-foreground tabular-nums">{fmt(r.commissionAmount)}</span>
                          <span className="ml-2 text-xs text-red-600 font-bold">CUT</span>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-green-700 tabular-nums">{fmt(r.commissionAmount)}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, iconColor, iconBg, valueColor, activeRing,
  loading, highlight = false, isActive, onClick,
}: {
  label: string;
  value: string | null;
  sub: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  valueColor: string;
  activeRing: string;
  loading: boolean;
  highlight?: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={!loading ? onClick : undefined}
      className={[
        "shadow-sm transition-all duration-150 cursor-pointer select-none",
        isActive
          ? `ring-2 ${activeRing} shadow-md scale-[1.02]`
          : "hover:shadow-md hover:scale-[1.01]",
        highlight && !isActive ? "border-red-200" : "",
      ].join(" ")}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
            {label}
          </p>
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
            {icon}
          </div>
        </div>
        {loading ? (
          <div className="h-7 w-24 bg-muted/50 rounded animate-pulse mb-1" />
        ) : (
          <p className={`text-lg sm:text-xl font-bold tabular-nums ${valueColor} truncate`}>{value}</p>
        )}
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}
