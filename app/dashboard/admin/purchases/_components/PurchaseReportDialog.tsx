"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Printer, Share2 } from "lucide-react";
import { Purchase } from "../types";
import {
  GroupMode,
  ReportColumns,
  ReportOptions,
  defaultReportOptions,
  downloadPurchaseReport,
  groupName,
  printPurchaseReport,
  sharePurchaseReport,
} from "../purchase-report";

interface PurchaseReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchases: Purchase[]; // already filtered to the selected month
  monthLabel: string;
  initialMode: GroupMode;
}

// Remember the last layout the user picked (per browser)
const STORAGE_KEY = "purchase-report-options";

type SavedLayout = Pick<ReportOptions, "title" | "showBoxes" | "showSummary" | "showDetails" | "columns">;

function loadLayout(): Partial<SavedLayout> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLayout(layout: SavedLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

const COLUMN_LABELS: { key: keyof ReportColumns; label: string }[] = [
  { key: "bills", label: "Bills (count)" },
  { key: "amount", label: "Amount" },
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Unpaid" },
  { key: "share", label: "Share %" },
];

export function PurchaseReportDialog({
  open,
  onOpenChange,
  purchases,
  monthLabel,
  initialMode,
}: PurchaseReportDialogProps) {
  const [opt, setOpt] = useState<ReportOptions>(() => defaultReportOptions(initialMode));

  // Reset when opened: keep saved layout, use current group mode, select everyone
  useEffect(() => {
    if (!open) return;
    setOpt({ ...defaultReportOptions(initialMode), ...loadLayout(), mode: initialMode, selectedNames: null });
  }, [open, initialMode]);

  const names = useMemo(() => {
    const totals = new Map<string, number>();
    purchases
      .filter((p) => p.status !== "Cancelled")
      .forEach((p) => {
        const n = groupName(p, opt.mode);
        totals.set(n, (totals.get(n) || 0) + (Number(p.totalAmount) || 0));
      });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [purchases, opt.mode]);

  const selected = opt.selectedNames ?? names;
  const isSelected = (n: string) => selected.includes(n);

  const set = (patch: Partial<ReportOptions>) => setOpt((o) => ({ ...o, ...patch }));
  const setCol = (key: keyof ReportColumns, v: boolean) =>
    setOpt((o) => ({ ...o, columns: { ...o.columns, [key]: v } }));

  const toggleName = (n: string, v: boolean) => {
    const next = v ? [...selected, n] : selected.filter((x) => x !== n);
    set({ selectedNames: next.length === names.length ? null : next });
  };

  const applyPreset = (preset: "summary" | "full") => {
    const base = defaultReportOptions(opt.mode);
    set(
      preset === "summary"
        ? { showBoxes: true, showSummary: true, showDetails: false, columns: base.columns }
        : { showBoxes: true, showSummary: true, showDetails: true, columns: base.columns }
    );
  };

  const run = (fn: typeof downloadPurchaseReport) => {
    saveLayout({
      title: opt.title,
      showBoxes: opt.showBoxes,
      showSummary: opt.showSummary,
      showDetails: opt.showDetails,
      columns: opt.columns,
    });
    fn(purchases, monthLabel, opt);
  };

  const groupLabel = opt.mode === "supplier" ? "Suppliers" : "Businesses";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Purchase Report</DialogTitle>
          <DialogDescription>
            Champika Hardware — {monthLabel}. Choose what to include, then print, download or share.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => applyPreset("summary")}>
              Summary only
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset("full")}>
              Full report (with bills)
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-title">Report title</Label>
              <Input
                id="report-title"
                value={opt.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Purchase Report"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Group by</Label>
              <div className="flex gap-1 rounded-md border p-1 w-fit">
                {(["supplier", "business"] as GroupMode[]).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={opt.mode === m ? "default" : "ghost"}
                    onClick={() => set({ mode: m, selectedNames: null })}
                  >
                    {m === "supplier" ? "Supplier" : "Business"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Sections</p>
              {[
                { key: "showBoxes" as const, label: "Total boxes at the top" },
                { key: "showSummary" as const, label: `Summary table by ${opt.mode}` },
                { key: "showDetails" as const, label: "Bill details (every bill)" },
              ].map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={opt[s.key]}
                    onCheckedChange={(v) => set({ [s.key]: v === true } as Partial<ReportOptions>)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Columns</p>
              {COLUMN_LABELS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={opt.columns[c.key]}
                    onCheckedChange={(v) => setCol(c.key, v === true)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {groupLabel} ({selected.length} of {names.length})
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => set({ selectedNames: null })}>
                  Select all
                </Button>
                <Button size="sm" variant="ghost" onClick={() => set({ selectedNames: [] })}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 max-h-48 overflow-y-auto rounded-md border p-3">
              {names.length === 0 && (
                <p className="text-sm text-muted-foreground">No purchases in {monthLabel}.</p>
              )}
              {names.map((n) => (
                <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={isSelected(n)} onCheckedChange={(v) => toggleName(n, v === true)} />
                  <span className="truncate">{n}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => run(printPurchaseReport)}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" onClick={() => run(downloadPurchaseReport)}>
            <Download className="w-4 h-4 mr-1" /> Download PDF
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => run(sharePurchaseReport)}
          >
            <Share2 className="w-4 h-4 mr-1" /> Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
