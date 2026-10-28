"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, FileText } from "lucide-react";
import { Purchase } from "../types";
import { PurchaseReportDialog } from "./PurchaseReportDialog";

interface MonthlyPurchaseSummaryProps {
  purchases: Purchase[]; // already filtered to the selected month
  monthLabel: string;
}

type Row = {
  name: string;
  count: number;
  total: number;
  paid: number;
  unpaid: number;
};

const fmt = (n: number) =>
  "LKR " +
  n.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function groupBy(purchases: Purchase[], key: (p: Purchase) => string): Row[] {
  const map = new Map<string, Row>();
  for (const p of purchases) {
    const name = key(p);
    const total = Number(p.totalAmount) || 0;
    const paid = Number(p.paidAmount) || 0;
    const row = map.get(name) || { name, count: 0, total: 0, paid: 0, unpaid: 0 };
    row.count += 1;
    row.total += total;
    row.paid += paid;
    row.unpaid += total - paid;
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function MonthlyPurchaseSummary({
  purchases,
  monthLabel,
}: MonthlyPurchaseSummaryProps) {
  const [groupMode, setGroupMode] = useState<"supplier" | "business">(
    "supplier"
  );
  const [reportOpen, setReportOpen] = useState(false);

  // Cancelled orders are not counted as purchases
  const active = useMemo(
    () => purchases.filter((p) => p.status !== "Cancelled"),
    [purchases]
  );

  const rows = useMemo(
    () =>
      groupBy(active, (p) =>
        groupMode === "supplier"
          ? p.supplierName || "Unknown supplier"
          : p.businessName || "No business"
      ),
    [active, groupMode]
  );

  const totals = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      total: acc.total + r.total,
      paid: acc.paid + r.paid,
      unpaid: acc.unpaid + r.unpaid,
    }),
    { count: 0, total: 0, paid: 0, unpaid: 0 }
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="w-4 h-4 text-blue-600" />
          Purchase Summary — {monthLabel}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border p-1">
            <Button
              size="sm"
              variant={groupMode === "supplier" ? "default" : "ghost"}
              onClick={() => setGroupMode("supplier")}
            >
              By Supplier
            </Button>
            <Button
              size="sm"
              variant={groupMode === "business" ? "default" : "ghost"}
              onClick={() => setGroupMode("business")}
            >
              By Business
            </Button>
          </div>
          <Button size="sm" onClick={() => setReportOpen(true)}>
            <FileText className="w-4 h-4 mr-1" /> Report (Print / PDF / Share)
          </Button>
        </div>
        <PurchaseReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          purchases={purchases}
          monthLabel={monthLabel}
          initialMode={groupMode}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Bills</p>
            <p className="text-lg font-bold">{totals.count}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Purchased Amount</p>
            <p className="text-lg font-bold text-blue-600">{fmt(totals.total)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-green-600">{fmt(totals.paid)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Unpaid</p>
            <p className="text-lg font-bold text-red-600">{fmt(totals.unpaid)}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No purchases in {monthLabel}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">
                    {groupMode === "supplier" ? "Supplier" : "Business"}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right">Bills</th>
                  <th className="py-2 pr-4 font-medium text-right">Amount</th>
                  <th className="py-2 pr-4 font-medium text-right">Paid</th>
                  <th className="py-2 pr-4 font-medium text-right">Unpaid</th>
                  <th className="py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    <td className="py-2 pr-4 text-right">{r.count}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.total)}</td>
                    <td className="py-2 pr-4 text-right text-green-600">
                      {fmt(r.paid)}
                    </td>
                    <td className="py-2 pr-4 text-right text-red-600">
                      {fmt(r.unpaid)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {totals.total > 0
                        ? ((r.total / totals.total) * 100).toFixed(1) + "%"
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
