"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Database,
  Users,
  Package,
  Receipt,
  ShoppingCart,
  Banknote,
  Coins,
  FileText,
  Factory,
  UserCog,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  BUSINESS_IDS,
  BUSINESS_NAMES,
  BUSINESS_THEMES,
} from "@/app/config/business-constants";

// ─── Types ────────────────────────────────────────────────────────────────────
type EntityKey =
  | "customers"
  | "products"
  | "invoices"
  | "orders"
  | "payments"
  | "expenses"
  | "purchases"
  | "suppliers"
  | "profiles";

interface ExportModuleItem {
  key: EntityKey;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface ExportLog {
  id: string;
  label: string;
  businessName: string;
  recordCount: number;
  exportedAt: Date;
  status: "success" | "error";
  message?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const EXPORT_MODULES: ExportModuleItem[] = [
  {
    key: "customers",
    label: "Customers",
    icon: Users,
    color: "blue",
    description: "Shop details, contacts, credit limits, balances",
  },
  {
    key: "products",
    label: "Products",
    icon: Package,
    color: "violet",
    description: "SKUs, pricing, stock levels, categories",
  },
  {
    key: "invoices",
    label: "Invoices",
    icon: Receipt,
    color: "amber",
    description: "Invoice numbers, amounts, payment status",
  },
  {
    key: "orders",
    label: "Orders",
    icon: ShoppingCart,
    color: "indigo",
    description: "All orders with dates and statuses",
  },
  {
    key: "payments",
    label: "Payments",
    icon: Banknote,
    color: "emerald",
    description: "Cash, cheque, and bank payment records",
  },
  {
    key: "expenses",
    label: "Expenses",
    icon: Coins,
    color: "orange",
    description: "Operational expenses by category",
  },
  {
    key: "purchases",
    label: "Purchases",
    icon: FileText,
    color: "cyan",
    description: "Supplier purchase orders & payments",
  },
  {
    key: "suppliers",
    label: "Suppliers",
    icon: Factory,
    color: "rose",
    description: "Supplier contacts, categories, due amounts",
  },
  {
    key: "profiles",
    label: "Users",
    icon: UserCog,
    color: "slate",
    description: "System users and their roles",
  },
];

// Businesses for tabs
const BUSINESSES = [
  { id: "all", name: "All Businesses", color: "gray" },
  {
    id: BUSINESS_IDS.CHAMPIKA_RETAIL,
    name: "Champika Retail",
    color: "green",
  },
  {
    id: BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
    name: "Distribution",
    color: "blue",
  },
  { id: BUSINESS_IDS.ORANGE_AGENCY, name: "Orange Agency", color: "orange" },
  { id: BUSINESS_IDS.WIREMAN_AGENCY, name: "Wireman Agency", color: "red" },
  { id: BUSINESS_IDS.SIERRA_AGENCY, name: "Sierra Agency", color: "purple" },
];

const COLOR_MAP: Record<string, { icon: string; tab: string; badge: string; border: string }> = {
  blue:   { icon: "bg-blue-100 text-blue-600",   tab: "data-[state=active]:border-blue-500 data-[state=active]:text-blue-700",   badge: "bg-blue-100 text-blue-700",   border: "border-l-blue-500" },
  violet: { icon: "bg-violet-100 text-violet-600", tab: "data-[state=active]:border-violet-500 data-[state=active]:text-violet-700", badge: "bg-violet-100 text-violet-700", border: "border-l-violet-500" },
  amber:  { icon: "bg-amber-100 text-amber-600",  tab: "data-[state=active]:border-amber-500 data-[state=active]:text-amber-700",  badge: "bg-amber-100 text-amber-700",  border: "border-l-amber-500" },
  indigo: { icon: "bg-indigo-100 text-indigo-600", tab: "data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700", badge: "bg-indigo-100 text-indigo-700", border: "border-l-indigo-500" },
  emerald:{ icon: "bg-emerald-100 text-emerald-600", tab: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700", badge: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-500" },
  orange: { icon: "bg-orange-100 text-orange-600", tab: "data-[state=active]:border-orange-500 data-[state=active]:text-orange-700", badge: "bg-orange-100 text-orange-700", border: "border-l-orange-500" },
  cyan:   { icon: "bg-cyan-100 text-cyan-600",    tab: "data-[state=active]:border-cyan-500 data-[state=active]:text-cyan-700",    badge: "bg-cyan-100 text-cyan-700",    border: "border-l-cyan-500" },
  rose:   { icon: "bg-rose-100 text-rose-600",    tab: "data-[state=active]:border-rose-500 data-[state=active]:text-rose-700",    badge: "bg-rose-100 text-rose-700",    border: "border-l-rose-500" },
  slate:  { icon: "bg-slate-100 text-slate-600",  tab: "data-[state=active]:border-slate-500 data-[state=active]:text-slate-700",  badge: "bg-slate-100 text-slate-700",  border: "border-l-slate-500" },
  gray:   { icon: "bg-gray-100 text-gray-600",    tab: "data-[state=active]:border-gray-500 data-[state=active]:text-gray-700",    badge: "bg-gray-100 text-gray-700",    border: "border-l-gray-500" },
  green:  { icon: "bg-green-100 text-green-600",  tab: "data-[state=active]:border-green-500 data-[state=active]:text-green-700",  badge: "bg-green-100 text-green-700",  border: "border-l-green-500" },
  red:    { icon: "bg-red-100 text-red-600",      tab: "data-[state=active]:border-red-500 data-[state=active]:text-red-700",      badge: "bg-red-100 text-red-700",      border: "border-l-red-500" },
  purple: { icon: "bg-purple-100 text-purple-600", tab: "data-[state=active]:border-purple-500 data-[state=active]:text-purple-700", badge: "bg-purple-100 text-purple-700", border: "border-l-purple-500" },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function BackupPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState("all");

  const addLog = (log: ExportLog) =>
    setExportLogs((prev) => [log, ...prev].slice(0, 20));

  const getBusinessLabel = (bizId: string) => {
    if (bizId === "all") return "All Businesses";
    return BUSINESS_NAMES[bizId as keyof typeof BUSINESS_NAMES] ?? "Unknown";
  };

  // ── Core export function ──────────────────────────────────────────────────
  const fetchAndExport = async (
    entityKey: EntityKey | "all",
    entityLabel: string,
    bizId: string
  ) => {
    const loadKey = `${bizId}_${entityKey}`;
    setLoadingKey(loadKey);

    try {
      let url = `/api/backup/export?entity=${entityKey}`;
      if (bizId !== "all") url += `&businessId=${bizId}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Export failed");

      const wb = XLSX.utils.book_new();
      let totalRows = 0;

      Object.entries(json.results as Record<string, any[]>).forEach(
        ([key, rows]) => {
          if (!rows || rows.length === 0) return;

          // Prettify column headers
          const prettified = rows.map((row: any) => {
            const out: Record<string, any> = {};
            Object.entries(row).forEach(([k, v]) => {
              const header = k
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
              out[header] = v;
            });
            return out;
          });

          const ws = XLSX.utils.json_to_sheet(prettified);
          const colWidths = Object.keys(prettified[0] || {}).map((k) => ({
            wch: Math.max(k.length + 2, 14),
          }));
          ws["!cols"] = colWidths;
          const sheetName = key.charAt(0).toUpperCase() + key.slice(1);
          XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
          totalRows += rows.length;
        }
      );

      if (totalRows === 0) {
        toast.info("No records found for this selection");
        return;
      }

      const bizSlug =
        bizId === "all"
          ? "AllBusinesses"
          : getBusinessLabel(bizId).replace(/\s+/g, "");
      const dateStr = new Date()
        .toLocaleDateString("en-LK")
        .replace(/\//g, "-");
      const fileName =
        entityKey === "all"
          ? `Champika-${bizSlug}-FullBackup-${dateStr}.xlsx`
          : `Champika-${bizSlug}-${entityLabel}-${dateStr}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success(
        `${entityLabel} (${getBusinessLabel(bizId)}) — ${totalRows.toLocaleString()} records exported`
      );

      addLog({
        id: crypto.randomUUID(),
        label: entityLabel,
        businessName: getBusinessLabel(bizId),
        recordCount: totalRows,
        exportedAt: new Date(),
        status: "success",
      });
    } catch (err: any) {
      toast.error(err.message);
      addLog({
        id: crypto.randomUUID(),
        label: entityLabel,
        businessName: getBusinessLabel(bizId),
        recordCount: 0,
        exportedAt: new Date(),
        status: "error",
        message: err.message,
      });
    } finally {
      setLoadingKey(null);
    }
  };

  // ── Module export grid (shared across tabs) ───────────────────────────────
  const ModuleGrid = ({ bizId }: { bizId: string }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {EXPORT_MODULES.map((item) => {
        const Icon = item.icon;
        const loadKey = `${bizId}_${item.key}`;
        const isLoading = loadingKey === loadKey;
        const iconCls =
          COLOR_MAP[item.color]?.icon ?? "bg-slate-100 text-slate-600";

        return (
          <Card key={item.key} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconCls}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">{item.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <CardDescription className="text-xs leading-relaxed">
                {item.description}
              </CardDescription>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={!!loadingKey}
                onClick={() =>
                  fetchAndExport(item.key, item.label, bizId)
                }
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isLoading ? "Exporting…" : `Export ${item.label}`}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  // ── Full backup button ────────────────────────────────────────────────────
  const FullBackupButton = ({ bizId }: { bizId: string }) => {
    const loadKey = `${bizId}_all`;
    const isLoading = loadingKey === loadKey;
    const bizLabel =
      bizId === "all" ? "Full System Backup" : `${getBusinessLabel(bizId)} — Full Backup`;
    return (
      <Button
        size="lg"
        disabled={!!loadingKey}
        onClick={() => fetchAndExport("all", bizLabel, bizId)}
        className="gap-2 shrink-0"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Database className="w-5 h-5" />
        )}
        {isLoading ? "Exporting…" : bizLabel}
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <HardDrive className="w-7 h-7 text-primary" />
            Backup & Data Export
          </h1>
          <p className="text-muted-foreground mt-1">
            Export data for any business to Excel. Select a business tab to
            filter, or use All Businesses for a complete backup.
          </p>
        </div>
      </div>

      {/* Business Tabs */}
      <Tabs
        value={selectedBusiness}
        onValueChange={setSelectedBusiness}
        className="space-y-4"
      >
        {/* Tab List */}
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
          {BUSINESSES.map((biz) => (
            <TabsTrigger
              key={biz.id}
              value={biz.id}
              className="flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Building2 className="w-3.5 h-3.5" />
              {biz.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content for each business */}
        {BUSINESSES.map((biz) => (
          <TabsContent key={biz.id} value={biz.id} className="space-y-4">
            {/* Banner */}
            <Card
              className={`border-l-4 ${
                biz.id === "all"
                  ? "border-l-primary bg-primary/5"
                  : biz.color === "green"
                  ? "border-l-green-500 bg-green-50/40"
                  : biz.color === "blue"
                  ? "border-l-blue-500 bg-blue-50/40"
                  : biz.color === "orange"
                  ? "border-l-orange-500 bg-orange-50/40"
                  : biz.color === "red"
                  ? "border-l-red-500 bg-red-50/40"
                  : "border-l-purple-500 bg-purple-50/40"
              }`}
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Database className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      {biz.id === "all"
                        ? "Full System Backup — All 5 Businesses"
                        : `${biz.name} — Full Backup`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {biz.id === "all"
                        ? "Exports all 9 tables across every business into one Excel file with separate sheets."
                        : `Exports all modules filtered for ${biz.name} only — Customers, Orders, Invoices, Expenses, Purchases, Suppliers, Users.`}
                    </p>
                  </div>
                </div>
                <FullBackupButton bizId={biz.id} />
              </CardContent>
            </Card>

            {/* Module grid */}
            <div>
              <h2 className="text-base font-semibold mb-3 text-muted-foreground uppercase tracking-wide text-xs">
                Export by Module
                {biz.id !== "all" && (
                  <Badge variant="outline" className="ml-2 text-xs normal-case font-normal">
                    {biz.name}
                  </Badge>
                )}
              </h2>
              <ModuleGrid bizId={biz.id} />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Export Log */}
      {exportLogs.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Export History{" "}
              <span className="text-sm font-normal text-muted-foreground">
                (this session)
              </span>
            </h2>
            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y">
                  {exportLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        {log.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{log.label}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {log.businessName}
                          </p>
                          {log.message && (
                            <p className="text-xs text-destructive">{log.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        {log.status === "success" && (
                          <Badge
                            variant="secondary"
                            className="font-normal text-xs"
                          >
                            {log.recordCount.toLocaleString()} rows
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.exportedAt.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Notes */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">Notes on Data Export</p>
              <ul className="list-disc ml-4 space-y-0.5 text-xs">
                <li>
                  Business-specific tabs filter Customers, Orders, Expenses,
                  Purchases, Suppliers, and Users by that business.
                </li>
                <li>
                  Products and Payments are shared across businesses and always
                  export in full.
                </li>
                <li>
                  All exports are real-time snapshots — data is current at the
                  moment of download.
                </li>
                <li>
                  Sensitive data (passwords, API keys) is never included.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
