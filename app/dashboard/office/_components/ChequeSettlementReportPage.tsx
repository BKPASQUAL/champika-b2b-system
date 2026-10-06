"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Download,
  Calendar,
  Clock,
  Banknote,
  CheckCircle,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  TrendingUp,
  Layers,
  Filter,
  Users,
  Eye,
  Share2,
  MessageCircle,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WhatsAppShareDialog } from "@/components/ui/WhatsAppShareDialog";
import {
  ChequeSettlementRow,
  downloadChequeSettlementPdf,
  printChequeSettlementPdf,
  getChequeSettlementPdfBlob,
  buildCustomerWhatsAppMessage,
} from "./cheque-settlement-pdf";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ChequeStatus = "Pending" | "Deposited" | "Cleared" | "Bounced" | "Returned";
type ThemeColor = "purple" | "red" | "blue" | "orange" | "gray";

export interface ChequeSettlementReportPageProps {
  defaultBusinessId?: string;
  portalName: string;
  themeColor: ThemeColor;
  Icon: React.ComponentType<{ className?: string }>;
  managementHref?: string;
  reportHref?: string;
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

function parseChequeNo(raw: string | null): { no: string | null; branch: string | null } {
  if (!raw) return { no: null, branch: null };
  const match = raw.match(/^(.+?)\s*\(Branch:\s*(.+?)\)$/);
  if (match) return { no: match[1].trim(), branch: match[2].trim() };
  return { no: raw, branch: null };
}

function calculateDaysDifference(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined
): number {
  if (!endDateStr) return 0;
  const end = new Date(endDateStr).getTime();
  const start = startDateStr ? new Date(startDateStr).getTime() : end;
  const diffTime = end - start;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

const THEME: Record<ThemeColor, { header: string; iconWrap: string; badge: string }> = {
  purple: {
    header: "text-purple-900",
    iconWrap: "bg-purple-100 text-purple-600",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
  red: {
    header: "text-red-900",
    iconWrap: "bg-red-100 text-red-600",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
  blue: {
    header: "text-blue-900",
    iconWrap: "bg-blue-100 text-blue-600",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  orange: {
    header: "text-orange-900",
    iconWrap: "bg-orange-100 text-orange-600",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
  gray: {
    header: "text-gray-900",
    iconWrap: "bg-gray-100 text-gray-600",
    badge: "bg-gray-50 text-gray-700 border-gray-200",
  },
};

function DaysBadge({ days }: { days: number }) {
  if (days <= 30) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {days} Days
      </span>
    );
  }
  if (days <= 60) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        {days} Days
      </span>
    );
  }
  if (days <= 90) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        {days} Days
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
      {days} Days
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "pending") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
        Pending
      </Badge>
    );
  }
  if (s === "deposited") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        Deposited
      </Badge>
    );
  }
  if (s === "cleared") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
        Cleared
      </Badge>
    );
  }
  if (s === "bounced") {
    return (
      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">
        Bounced
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-xs">
      {status}
    </Badge>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ChequeSettlementReportPage({
  defaultBusinessId,
  portalName,
  themeColor,
  Icon,
  managementHref = "/dashboard/office/sierra/cheques",
  reportHref = "/dashboard/office/sierra/cheques/report",
}: ChequeSettlementReportPageProps) {
  const t = THEME[themeColor];
  const todayStr = new Date().toISOString().split("T")[0];

  const [businessId, setBusinessId] = useState<string | null>(defaultBusinessId ?? null);
  useEffect(() => {
    setBusinessId(defaultBusinessId ?? null);
  }, [defaultBusinessId]);

  const paymentsUrl = businessId
    ? `/api/payments?businessId=${businessId}`
    : `/api/payments`;

  const { data: rawPayments = [], loading, refetch } = useCachedFetch<any[]>(
    paymentsUrl,
    [],
    () => toast.error("Failed to load cheques data")
  );

  // ─── Filter State ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [futureOnly, setFutureOnly] = useState(true); // Default to future / post-dated cheques
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [daysFilter, setDaysFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<
    "days_desc" | "days_asc" | "date_asc" | "date_desc" | "amount_desc"
  >("days_desc");
  const [collapsedCustomers, setCollapsedCustomers] = useState<Record<string, boolean>>({});

  // ─── PDF Preview Modal State ───────────────────────────────────────────────
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    title: string;
    url: string | null;
    filename: string;
    cheques: ChequeSettlementRow[];
    customerFilter?: string;
    sortBy?: string;
  }>({
    open: false,
    title: "",
    url: null,
    filename: "",
    cheques: [],
  });

  // ─── WhatsApp Share Modal State ────────────────────────────────────────────
  const [shareModal, setShareModal] = useState<{
    open: boolean;
    customerName: string;
    phone: string;
    message: string;
    cheques: ChequeSettlementRow[];
  }>({
    open: false,
    customerName: "",
    phone: "",
    message: "",
    cheques: [],
  });

  // ─── Build Cheque Rows with Days Calculation ───────────────────────────────
  const allCheques = useMemo<ChequeSettlementRow[]>(() => {
    return rawPayments
      .filter((p: any) => p.payment_method?.toLowerCase() === "cheque" && !p.is_cancelled)
      .map((p: any): ChequeSettlementRow => {
        const { no, branch } = parseChequeNo(p.cheque_number);
        const invoiceDate =
          p.invoices?.invoice_date ||
          p.orders?.order_date ||
          p.invoices?.created_at ||
          p.payment_date ||
          null;
        const chequeDate = p.cheque_date || null;
        const settlementDays = calculateDaysDifference(invoiceDate, chequeDate);

        return {
          id: p.id,
          customerName: p.customers?.name || "Unknown Customer",
          invoiceNo: p.invoices?.invoice_no || p.orders?.order_number || "—",
          invoiceDate,
          chequeDate,
          chequeNo: no,
          bankCode: p.banks?.bank_code ?? null,
          bankName: p.banks?.bank_name ?? null,
          branchCode: branch,
          amount: Number(p.amount) || 0,
          status: p.cheque_status || "Pending",
          settlementDays,
        };
      });
  }, [rawPayments]);

  // Distinct customer list for filter dropdown
  const customerList = useMemo(() => {
    const set = new Set<string>();
    allCheques.forEach((c) => {
      if (c.customerName) set.add(c.customerName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allCheques]);

  // ─── Filtered Cheques ───────────────────────────────────────────────────────
  const filteredCheques = useMemo<ChequeSettlementRow[]>(() => {
    return allCheques.filter((c) => {
      // Future filter: only Pending/Deposited or chequeDate >= today
      if (futureOnly) {
        const isFutureStatus = c.status === "Pending" || c.status === "Deposited";
        const isFutureDate = c.chequeDate ? c.chequeDate >= todayStr : true;
        if (!isFutureStatus && !isFutureDate) return false;
      }

      // Status filter
      if (statusFilter !== "All" && c.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Customer filter
      if (customerFilter !== "all" && c.customerName !== customerFilter) {
        return false;
      }

      // Days duration filter
      if (daysFilter === "60plus" && c.settlementDays < 60) return false;
      if (daysFilter === "30" && c.settlementDays > 30) return false;
      if (daysFilter === "60" && (c.settlementDays <= 30 || c.settlementDays > 60)) return false;
      if (daysFilter === "90" && (c.settlementDays <= 60 || c.settlementDays > 90)) return false;
      if (daysFilter === "90plus" && c.settlementDays <= 90) return false;

      // Date range filter
      if (dateFrom && c.chequeDate && c.chequeDate < dateFrom) return false;
      if (dateTo && c.chequeDate && c.chequeDate > dateTo) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          c.customerName.toLowerCase().includes(q) ||
          (c.chequeNo && c.chequeNo.toLowerCase().includes(q)) ||
          (c.invoiceNo && c.invoiceNo.toLowerCase().includes(q)) ||
          (c.bankName && c.bankName.toLowerCase().includes(q)) ||
          (c.bankCode && c.bankCode.toLowerCase().includes(q)) ||
          (c.branchCode && c.branchCode.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [allCheques, futureOnly, statusFilter, customerFilter, daysFilter, dateFrom, dateTo, search, todayStr]);

  // ─── Summary Metrics ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalCount = filteredCheques.length;
    const totalAmount = filteredCheques.reduce((s, c) => s + c.amount, 0);
    const avgDays =
      totalCount > 0
        ? Math.round(
            filteredCheques.reduce((s, c) => s + c.settlementDays, 0) / totalCount
          )
        : 0;

    const pendingCount = filteredCheques.filter((c) => c.status === "Pending").length;
    const pendingAmount = filteredCheques
      .filter((c) => c.status === "Pending")
      .reduce((s, c) => s + c.amount, 0);

    const depositedCount = filteredCheques.filter((c) => c.status === "Deposited").length;
    const depositedAmount = filteredCheques
      .filter((c) => c.status === "Deposited")
      .reduce((s, c) => s + c.amount, 0);

    return {
      totalCount,
      totalAmount,
      avgDays,
      pendingCount,
      pendingAmount,
      depositedCount,
      depositedAmount,
    };
  }, [filteredCheques]);

  // ─── Grouped by Customer ───────────────────────────────────────────────────
  const customerGroups = useMemo(() => {
    const map = new Map<string, ChequeSettlementRow[]>();
    filteredCheques.forEach((c) => {
      const list = map.get(c.customerName) || [];
      list.push(c);
      map.set(c.customerName, list);
    });

    return Array.from(map.entries())
      .map(([customerName, cheques]) => {
        const total = cheques.reduce((s, c) => s + c.amount, 0);
        const avg =
          cheques.length > 0
            ? Math.round(
                cheques.reduce((s, c) => s + c.settlementDays, 0) / cheques.length
              )
            : 0;
        const sorted = [...cheques].sort((a, b) => {
          if (sortBy === "days_desc") return b.settlementDays - a.settlementDays;
          if (sortBy === "days_asc") return a.settlementDays - b.settlementDays;
          if (sortBy === "amount_desc") return b.amount - a.amount;
          if (sortBy === "date_desc") {
            const da = a.chequeDate ? new Date(a.chequeDate).getTime() : 0;
            const db = b.chequeDate ? new Date(b.chequeDate).getTime() : 0;
            return db - da;
          }
          const da = a.chequeDate ? new Date(a.chequeDate).getTime() : 0;
          const db = b.chequeDate ? new Date(b.chequeDate).getTime() : 0;
          return da - db;
        });
        return {
          customerName,
          cheques: sorted,
          totalAmount: total,
          avgDays: avg,
        };
      })
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [filteredCheques, sortBy]);

  const toggleCustomer = (custName: string) => {
    setCollapsedCustomers((prev) => ({
      ...prev,
      [custName]: !prev[custName],
    }));
  };

  const isDirty =
    search !== "" ||
    !futureOnly ||
    statusFilter !== "All" ||
    daysFilter !== "all" ||
    customerFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortBy !== "days_desc";

  const handleReset = () => {
    setSearch("");
    setFutureOnly(true);
    setStatusFilter("All");
    setDaysFilter("all");
    setCustomerFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("days_desc");
  };

  // ─── PDF Preview Handler ───────────────────────────────────────────────────
  const handleOpenPdfPreview = (
    cheques: ChequeSettlementRow[],
    title: string,
    custFilter?: string,
    sortOption?: string
  ) => {
    if (cheques.length === 0) {
      toast.info("No cheques to preview");
      return;
    }
    const sort = sortOption || sortBy;
    const { url, filename } = getChequeSettlementPdfBlob(cheques, portalName, custFilter, sort);
    setPreviewModal({
      open: true,
      title,
      url,
      filename,
      cheques,
      customerFilter: custFilter,
      sortBy: sort,
    });
  };

  // ─── WhatsApp / Share Handler ──────────────────────────────────────────────
  const handleOpenShare = (customerName: string, cheques: ChequeSettlementRow[]) => {
    if (cheques.length === 0) {
      toast.info("No cheques to share");
      return;
    }
    const message = buildCustomerWhatsAppMessage(customerName, cheques, portalName);
    setShareModal({
      open: true,
      customerName,
      phone: "",
      message,
      cheques,
    });
  };

  const handlePortfolioShare = () => {
    if (filteredCheques.length === 0) {
      toast.info("No cheques to share");
      return;
    }
    const totalAmount = filteredCheques.reduce((s, c) => s + c.amount, 0);
    let msg = `*${portalName.toUpperCase()} — CHEQUE REALIZATION DAYS SUMMARY*\n`;
    msg += `📅 *Date:* ${new Date().toLocaleDateString("en-GB")}\n`;
    msg += `📊 *Total Active Cheques:* ${filteredCheques.length} Cheques\n`;
    msg += `💰 *Portfolio Value:* LKR ${formatCurrency(totalAmount)}\n`;
    msg += `⏱ *Avg Settlement Period:* ${stats.avgDays} Days\n`;
    msg += `⏳ *Pending Realization:* ${stats.pendingCount} Cheques (${formatCurrency(stats.pendingAmount)})\n`;
    msg += `🏦 *Deposited in Bank:* ${stats.depositedCount} Cheques (${formatCurrency(stats.depositedAmount)})\n`;
    msg += `👥 *Customer Count:* ${customerGroups.length} Customers\n`;

    setShareModal({
      open: true,
      customerName: "All Customers (Portfolio Summary)",
      phone: "",
      message: msg,
      cheques: filteredCheques,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl shadow-sm", t.iconWrap)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={cn("text-2xl font-bold tracking-tight", t.header)}>
                Cheque Realization & Settlement Days
              </h1>
              <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border", t.badge)}>
                {portalName}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Track settlement duration from Bill Creation Date to Cheque Pass Date per customer
            </p>
          </div>
        </div>

        {/* Action Buttons & Quick Nav */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1 text-xs"
          >
            <Link href={managementHref}>
              Cheque Management
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1 text-xs"
          >
            <Link href={reportHref}>
              Date Report
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>

          {/* Show / Preview PDF Button */}
          <Button
            onClick={() =>
              handleOpenPdfPreview(
                filteredCheques,
                `${portalName} — Realization Days Report (${filteredCheques.length} Cheques)`,
                customerFilter,
                sortBy
              )
            }
            disabled={filteredCheques.length === 0 || loading}
            variant="outline"
            className="gap-1.5 text-xs font-medium border-purple-200 text-purple-700 hover:bg-purple-50"
            title="Preview PDF Document"
          >
            <Eye className="h-3.5 w-3.5 text-purple-600" />
            Show PDF
          </Button>

          {/* Download PDF Button */}
          <Button
            onClick={() => downloadChequeSettlementPdf(filteredCheques, portalName, customerFilter, sortBy)}
            disabled={filteredCheques.length === 0 || loading}
            className="gap-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium shadow-sm"
            title="Download PDF File"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>

          {/* Print Button */}
          <Button
            onClick={() => printChequeSettlementPdf(filteredCheques, portalName, customerFilter, sortBy)}
            disabled={filteredCheques.length === 0 || loading}
            variant="outline"
            className="gap-1.5 text-xs font-medium"
            title="Print Report"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>

          {/* Share Button */}
          <Button
            onClick={handlePortfolioShare}
            disabled={filteredCheques.length === 0 || loading}
            variant="outline"
            className="gap-1.5 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            title="Share via WhatsApp or Web"
          >
            <Share2 className="h-3.5 w-3.5 text-emerald-600" />
            Share
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={refetch}
            disabled={loading}
            title="Refresh data"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-purple-100 shadow-sm bg-gradient-to-br from-purple-50/50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-purple-900">
              Total Cheques
            </CardTitle>
            <Banknote className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-950">
              {formatCurrency(stats.totalAmount)}
            </div>
            <p className="text-xs text-purple-700 mt-1 font-medium">
              {stats.totalCount} active cheque{stats.totalCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-100 shadow-sm bg-gradient-to-br from-blue-50/50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-900">
              Avg Settlement Period
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-950">
              {stats.avgDays} <span className="text-sm font-normal text-muted-foreground">Days</span>
            </div>
            <p className="text-xs text-blue-700 mt-1 font-medium">
              From Invoice creation to Cheque date
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 shadow-sm bg-gradient-to-br from-amber-50/50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-900">
              Pending Cheques
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-950">
              {formatCurrency(stats.pendingAmount)}
            </div>
            <p className="text-xs text-amber-700 mt-1 font-medium">
              {stats.pendingCount} cheque{stats.pendingCount !== 1 ? "s" : ""} awaiting realization
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
              Deposited Cheques
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-950">
              {formatCurrency(stats.depositedAmount)}
            </div>
            <p className="text-xs text-emerald-700 mt-1 font-medium">
              {stats.depositedCount} cheque{stats.depositedCount !== 1 ? "s" : ""} in bank
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="shadow-sm border">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer, cheque #, invoice #, bank..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Quick Toggle: Future vs All + 60+ Days */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border flex-wrap">
              <Button
                variant={futureOnly && daysFilter !== "60plus" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 text-xs font-medium rounded-md px-2.5",
                  futureOnly && daysFilter !== "60plus"
                    ? "bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => {
                  setFutureOnly(true);
                  if (daysFilter === "60plus") setDaysFilter("all");
                }}
              >
                Future Cheques Only
              </Button>
              <Button
                variant={!futureOnly && daysFilter !== "60plus" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 text-xs font-medium rounded-md px-2.5",
                  !futureOnly && daysFilter !== "60plus"
                    ? "bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => {
                  setFutureOnly(false);
                  if (daysFilter === "60plus") setDaysFilter("all");
                }}
              >
                All Cheques (All Time)
              </Button>
              <Button
                variant={daysFilter === "60plus" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs font-semibold rounded-md px-2.5 transition-all",
                  daysFilter === "60plus"
                    ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-xs"
                    : "bg-white text-amber-800 border-amber-300 hover:bg-amber-50"
                )}
                onClick={() => setDaysFilter((prev) => (prev === "60plus" ? "all" : "60plus"))}
              >
                ⚡ 60+ Days Only
              </Button>
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            {/* Customer dropdown */}
            <div className="w-[180px]">
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">All Customers ({customerList.length})</SelectItem>
                  {customerList.map((cust) => (
                    <SelectItem key={cust} value={cust}>
                      {cust}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cheque Status */}
            <div className="w-[125px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Statuses" />
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
            </div>

            {/* Settlement Duration */}
            <div className="w-[155px]">
              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger className="h-8 text-xs font-medium">
                  <SelectValue placeholder="All Durations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Durations</SelectItem>
                  <SelectItem value="60plus">60+ Days (Extended & Critical)</SelectItem>
                  <SelectItem value="30">0 – 30 Days (Fast)</SelectItem>
                  <SelectItem value="60">31 – 60 Days (Standard)</SelectItem>
                  <SelectItem value="90">61 – 90 Days (Extended)</SelectItem>
                  <SelectItem value="90plus">&gt; 90 Days (Critical)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Dropdown */}
            <div className="w-[195px]">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-8 text-xs font-medium border-purple-200">
                  <SelectValue placeholder="Sort Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days_desc">Sort: 60+ Days / Longest First</SelectItem>
                  <SelectItem value="days_asc">Sort: Shortest Days First</SelectItem>
                  <SelectItem value="date_asc">Sort: Cheque Date (Earliest)</SelectItem>
                  <SelectItem value="date_desc">Sort: Cheque Date (Latest)</SelectItem>
                  <SelectItem value="amount_desc">Sort: Amount (Highest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <span>Cheque Date:</span>
              <Input
                type="date"
                className="h-8 w-[125px] text-xs"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span>to</span>
              <Input
                type="date"
                className="h-8 w-[125px] text-xs"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {isDirty && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleReset}
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Grouped by Customer */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-muted-foreground font-medium">Loading cheque realization data...</p>
        </div>
      ) : customerGroups.length === 0 ? (
        <Card className="border-dashed p-12 text-center shadow-none">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No Cheques Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            No customer cheques matched your current filter criteria. Try expanding the date range or resetting filters.
          </p>
          {isDirty && (
            <Button variant="outline" size="sm" onClick={handleReset} className="mt-4">
              Reset all filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <strong className="text-foreground">{filteredCheques.length}</strong> cheque(s) across{" "}
              <strong className="text-foreground">{customerGroups.length}</strong> customer(s)
            </span>
            <span>
              Total Portfolio:{" "}
              <strong className="text-foreground font-bold text-sm">
                {formatCurrency(stats.totalAmount)}
              </strong>
            </span>
          </div>

          {customerGroups.map((group) => {
            const isCollapsed = Boolean(collapsedCustomers[group.customerName]);

            return (
              <Card key={group.customerName} className="overflow-hidden border shadow-sm">
                {/* Customer Header */}
                <div
                  className="bg-slate-50/90 hover:bg-slate-100/90 border-b px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer transition-colors"
                  onClick={() => toggleCustomer(group.customerName)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {group.customerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{group.customerName}</h3>
                        <Badge variant="secondary" className="text-[11px] font-semibold">
                          {group.cheques.length} Cheque{group.cheques.length > 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Avg Settlement: <strong className="text-slate-700">{group.avgDays} Days</strong> from Bill Date
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap ml-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right mr-2">
                      <span className="text-[11px] text-muted-foreground block">Customer Total</span>
                      <span className="text-sm font-bold text-purple-950">
                        {formatCurrency(group.totalAmount)}
                      </span>
                    </div>

                    {/* Show PDF Preview for Single Customer */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 font-medium bg-white hover:bg-purple-50 border-purple-200 text-purple-700 hover:text-purple-800"
                      onClick={() =>
                        handleOpenPdfPreview(
                          group.cheques,
                          `Cheque Statement — ${group.customerName}`,
                          group.customerName,
                          sortBy
                        )
                      }
                      title={`Show PDF Preview for ${group.customerName}`}
                    >
                      <Eye className="h-3 w-3" />
                      Show PDF
                    </Button>

                    {/* Download PDF for Single Customer */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 font-medium bg-white hover:bg-purple-50 border-purple-200 text-purple-700 hover:text-purple-800"
                      onClick={() =>
                        downloadChequeSettlementPdf(group.cheques, portalName, group.customerName, sortBy)
                      }
                      title={`Download PDF for ${group.customerName}`}
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>

                    {/* Print Single Customer */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 font-medium bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
                      onClick={() =>
                        printChequeSettlementPdf(group.cheques, portalName, group.customerName, sortBy)
                      }
                      title={`Print Report for ${group.customerName}`}
                    >
                      <Printer className="h-3 w-3" />
                      Print
                    </Button>

                    {/* WhatsApp / Share for Single Customer */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 font-medium bg-white hover:bg-emerald-50 border-emerald-200 text-emerald-700 hover:text-emerald-800"
                      onClick={() => handleOpenShare(group.customerName, group.cheques)}
                      title={`Share statement for ${group.customerName} via WhatsApp`}
                    >
                      <MessageCircle className="h-3 w-3 text-emerald-600" />
                      Share
                    </Button>

                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-700 p-1 ml-1"
                      onClick={() => toggleCustomer(group.customerName)}
                      aria-label="Toggle section"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Table Rows for this customer */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead>Bill / Invoice Date</TableHead>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Cheque Date (Pass Date)</TableHead>
                          <TableHead>Cheque No</TableHead>
                          <TableHead>Bank / Branch</TableHead>
                          <TableHead className="text-center">Settlement Period</TableHead>
                          <TableHead className="text-right">Amount (LKR)</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.cheques.map((c, idx) => (
                          <TableRow key={c.id} className="hover:bg-slate-50/50 text-xs">
                            <TableCell className="text-center text-muted-foreground font-mono">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium text-slate-700">
                              {formatDate(c.invoiceDate)}
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-slate-900">
                              {c.invoiceNo}
                            </TableCell>
                            <TableCell className="font-medium text-purple-900">
                              {formatDate(c.chequeDate)}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-slate-800">
                              {c.chequeNo || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {c.bankCode && (
                                  <span className="font-mono font-semibold text-[10px] bg-slate-100 px-1 py-0.5 rounded border text-slate-700">
                                    {c.bankCode}
                                  </span>
                                )}
                                <span className="text-muted-foreground truncate max-w-[140px]">
                                  {c.bankName || "—"}
                                </span>
                                {c.branchCode && (
                                  <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-100">
                                    {c.branchCode}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <DaysBadge days={c.settlementDays} />
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-slate-900">
                              {formatCurrency(c.amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge status={c.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Customer Subtotal Footer */}
                    <div className="bg-slate-50/60 border-t px-4 py-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        Subtotal for {group.customerName} ({group.cheques.length} Cheque{group.cheques.length > 1 ? "s" : ""})
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCurrency(group.totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Grand Total Summary Bar at Bottom */}
          <div className="rounded-xl border bg-purple-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <h4 className="text-base font-bold">Portfolio Realization Summary</h4>
              <p className="text-xs text-purple-200">
                {filteredCheques.length} Cheque{filteredCheques.length !== 1 ? "s" : ""} across{" "}
                {customerGroups.length} Customer{customerGroups.length !== 1 ? "s" : ""} · Average Settlement Period:{" "}
                <strong>{stats.avgDays} Days</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1.5"
                onClick={() =>
                  handleOpenPdfPreview(
                    filteredCheques,
                    `${portalName} — Full Portfolio Realization Days Report`,
                    customerFilter,
                    sortBy
                  )
                }
              >
                <Eye className="h-3.5 w-3.5" />
                Show PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1.5"
                onClick={() => downloadChequeSettlementPdf(filteredCheques, portalName, customerFilter, sortBy)}
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <div className="text-right border-l border-white/20 pl-4 ml-2">
                <span className="text-xs text-purple-300 uppercase tracking-wider block">Grand Total</span>
                <span className="text-2xl font-black tabular-nums tracking-tight">
                  {formatCurrency(stats.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PDF PREVIEW MODAL ────────────────────────────────────────────── */}
      <Dialog
        open={previewModal.open}
        onOpenChange={(open) => {
          if (!open && previewModal.url) {
            URL.revokeObjectURL(previewModal.url);
          }
          setPreviewModal((prev) => ({ ...prev, open, url: open ? prev.url : null }));
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b pr-6">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              {previewModal.title}
            </DialogTitle>
          </DialogHeader>

          {/* Iframe PDF View */}
          <div className="flex-1 w-full h-full bg-slate-100 rounded-lg overflow-hidden border my-2">
            {previewModal.url ? (
              <iframe
                src={previewModal.url}
                className="w-full h-full border-none"
                title="PDF Document Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground font-mono">
              {previewModal.filename}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() =>
                  printChequeSettlementPdf(
                    previewModal.cheques,
                    portalName,
                    previewModal.customerFilter,
                    previewModal.sortBy || sortBy
                  )
                }
              >
                <Printer className="h-3.5 w-3.5" />
                Print PDF
              </Button>
              <Button
                size="sm"
                className="bg-purple-700 hover:bg-purple-800 text-white text-xs gap-1.5"
                onClick={() =>
                  downloadChequeSettlementPdf(
                    previewModal.cheques,
                    portalName,
                    previewModal.customerFilter,
                    previewModal.sortBy || sortBy
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setPreviewModal((prev) => ({ ...prev, open: false }))}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── WHATSAPP / SHARE DIALOG ──────────────────────────────────────── */}
      <WhatsAppShareDialog
        open={shareModal.open}
        onOpenChange={(open) => setShareModal((prev) => ({ ...prev, open }))}
        phone={shareModal.phone}
        message={shareModal.message}
        title={`Share Realization Statement — ${shareModal.customerName}`}
        pdfGenerator={async () => {
          const { blob, filename } = getChequeSettlementPdfBlob(
            shareModal.cheques,
            portalName,
            shareModal.customerName.includes("All") ? undefined : shareModal.customerName
          );
          return { blob, filename };
        }}
        entityType="cheque-settlement-pdf"
        entityId={shareModal.customerName.replace(/[^a-zA-Z0-9_-]/g, "_")}
      />
    </div>
  );
}
